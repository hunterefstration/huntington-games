// Proof Slice test. Needs no rig and no internet (the slice uses no three.js): serves the checkout itself.
//   node tools/tests/proof.mjs                 both slices
//   node tools/tests/proof.mjs yard            only these (yard, tank, speed, cpu, loader; gpu only when named)
//   node tools/tests/proof.mjs yard --yard=assets/_test/test.hgm     another asset file
//   node tools/tests/proof.mjs loader --live   the paste-in loader against the real CDN (the newest proofN tag)
//   node tools/tests/proof.mjs --shot=out.png  also save a picture of each slice (out-yard.png, out-tank.png)
// Checks: the assets load and draw with no script error or engine warning; the picture is not blank; the Chromebook
// budgets hold (draw calls, triangles in view, picture memory); figures animate, bullets hit, walls stop the player,
// the tank drives over the ground; the built-in speed test runs and stores a result.
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const args = process.argv.slice(2), parts = args.filter(a => !a.startsWith('--')), want = p => !parts.length || parts.includes(p);
const opt = n => { const a = args.find(a => a.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const BUDGET = { calls: 150, tris: 150000, mb: 100 };
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
let fails = 0; const ok = (c, what, info) => { console.log((c ? 'PASS  ' : 'FAIL  ') + what + (info !== undefined ? '  ' + info : '')); if (!c) fails++; };
async function open(query, br, size) {
    const ctx = await (br || browser).newContext({ viewport: size || { width: 960, height: 540 } }), page = await ctx.newPage(), msgs = [];
    page.on('pageerror', e => msgs.push('error: ' + e.message.slice(0, 200))); page.on('console', m => { if (/\[HG3D\]/.test(m.text()) || m.type() === 'error') msgs.push(m.text().slice(0, 240)); });
    await page.goto(base + '/Proof%20Slice/index.html?gov=0' + (query || ''), { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__proof, null, { timeout: 15000 });
    return { ctx, page, msgs };
}
// the middle of the picture, read back: how many different colours, how bright
const look = page => page.evaluate(() => {
    const H = window.__proof, gl = H.R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; H.step(1 / 60, 1);
    const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const seen = new Set(); let sum = 0, n = 0; for (let i = 0; i < px.length; i += 4 * 97) { seen.add((px[i] >> 3) << 10 | (px[i + 1] >> 3) << 5 | px[i + 2] >> 3); sum += px[i] + px[i + 1] + px[i + 2]; n += 3; }
    return { colours: seen.size, mean: sum / n };
});
async function budgets(page, name) {
    const s = await page.evaluate(() => { const H = window.__proof; let calls = 0, tris = 0; for (let i = 0; i < 90; i++) { H.step(1 / 30, 1); calls = Math.max(calls, H.App.calls); tris = Math.max(tris, H.App.tris); } return { calls, tris, mb: H.R.info.memory.textureBytes / 1048576, failed: H.R.failed || null, errors: H.App.errors }; });
    ok(!s.failed && !s.errors.length, name + ': no engine or script error', s.failed || s.errors.join(' | '));
    ok(s.calls > 0 && s.calls <= BUDGET.calls, name + ': draw calls within budget', s.calls + ' of ' + BUDGET.calls);
    ok(s.tris > 0 && s.tris <= BUDGET.tris, name + ': triangles within budget', Math.round(s.tris) + ' of ' + BUDGET.tris);
    ok(s.mb <= BUDGET.mb, name + ': picture memory within budget', s.mb.toFixed(0) + ' MB of ' + BUDGET.mb);
}

if (want('yard')) {
    const q = opt('yard') ? '&yard=' + encodeURIComponent(opt('yard')) : '', { ctx, page, msgs } = await open(q);
    const started = await page.evaluate(() => window.__proof.start('yard', true));
    ok(started, 'yard: loads and starts', await page.evaluate(() => document.getElementById('load').textContent));
    if (started) {
        const L = await look(page); ok(L.colours > 40 && L.mean > 12 && L.mean < 245, 'yard: the picture is not blank', L.colours + ' colours, mean ' + L.mean.toFixed(0));
        if (opt('shot')) await page.screenshot({ path: opt('shot').replace(/\.png$/, '-yard.png') });
        await budgets(page, 'yard');
        const play = await page.evaluate(() => {
            const H = window.__proof, Y = H.App.modes.yard, A = Y.A, out = {};
            out.enemies = Y.enemies.length; out.drawn = Y.crowd ? Y.crowd.drawn : 0; out.clips = Y.crowd ? Object.keys(Y.crowd.clips) : [];
            // animation: the same figure a third of a second later is on another frame
            const cl = Y.crowd.clips.walk || Y.crowd.clips[out.clips[0]]; out.f0 = A.frame(cl, 0.1); out.f1 = A.frame(cl, 0.3);
            // walls: somewhere on the map a blocked cell exists and the player cannot stand in it
            const G = Y.G; let b = -1; for (let i = 0; i < Y.blk.length; i++) if (Y.blk[i]) { b = i; break; }
            out.blocked = b >= 0 && yardBlockedAt(G.x0 + (b % G.nx + 0.5) * G.cell, G.z0 + ((b / G.nx | 0) + 0.5) * G.cell);
            function yardBlockedAt(x, z) { return H.yard.blocked(x, z, 0.3); }
            out.free = !H.yard.blocked(Y.home[0], Y.home[1], 0.3);
            // a bullet: one enemy straight ahead, nothing else
            H.App.demo = false; Y.start(false); const P = Y.P; P.yaw = 0; P.pitch = 0;
            let fz = 0; for (let d = 2; d < 12; d += 0.5) { if (H.yard.ray(P.x, 1.65, P.z, 0, 0, -1, d + 0.5) < d + 0.5) break; fz = d; }
            out.clear = fz;
            if (fz >= 2) { Y.enemies.push({ x: P.x, z: P.z - fz, yaw: 0, hp: 100, state: 'walk', t: 0, flash: 0, speed: 0, light: new Float32Array([1, 1, 1, 1]), hit: false, size: 1 }); H.yard.fire(P, 0, -0.25 / fz, -1); out.hp = Y.enemies[0].hp; out.ammo = P.ammo; }
            // probes: light in the open differs from spot to spot, never negative, never absurd
            let lo = 1e9, hi = 0; const o = new Float32Array(4); for (let i = 0; i < 200; i++) { A.probe(G.x0 + Math.random() * G.nx * G.cell, G.z0 + Math.random() * G.nz * G.cell, o); const l = o[0] + o[1] + o[2]; lo = Math.min(lo, l); hi = Math.max(hi, l); }
            out.lo = lo; out.hi = hi; out.tour = Y.tour.length;
            return out;
        });
        ok(play.enemies > 0 && play.drawn > 0, 'yard: enemies are spawned and drawn', play.enemies + ' alive, ' + play.drawn + ' drawn, clips ' + play.clips.join(','));
        ok(play.f0 !== play.f1, 'yard: figures animate', 'frame ' + play.f0 + ' -> ' + play.f1);
        ok(play.blocked && play.free, 'yard: walls stop the player, the start spot is free');
        ok(play.clear >= 2 && play.hp < 100 && play.ammo === 29, 'yard: a bullet hits the enemy ahead', 'hp ' + play.hp + ', clear ' + play.clear + ' m');
        ok(play.lo >= 0 && play.hi > play.lo && play.hi < 60, 'yard: baked light varies over the map', play.lo.toFixed(2) + ' .. ' + play.hi.toFixed(2));
        ok(play.tour > 20, 'yard: the speed test has a round trip to walk', play.tour + ' steps');
        // a real round: walk, then stand still; the first wave has to find its way round the cover and reach the player
        const round = await page.evaluate(() => {
            const H = window.__proof, Y = H.App.modes.yard; H.App.demo = false; H.App.paused = true; Y.start(false); const P = Y.P, x0 = P.x, z0 = P.z;
            H.keys.KeyW = true; H.step(1 / 30, 45); H.keys.KeyW = false; const moved = Math.hypot(P.x - x0, P.z - z0); let maxE = 0, firstHit = -1;
            for (let i = 0; i < 900 && !P.dead; i++) { H.step(1 / 30, 1); maxE = Math.max(maxE, Y.enemies.length); if (firstHit < 0 && P.hp < 100) firstHit = i / 30; }
            return { moved, maxE, firstHit, dead: P.dead, wave: Y.wave, reach: Y.reach, free: Y.nav.reduce((a, v) => a + (v ? 0 : 1), 0) };
        });
        ok(round.moved > 2 && round.moved < 6.5, 'yard: the player walks at walking speed', round.moved.toFixed(1) + ' m in 1.5 s');
        ok(round.wave >= 1 && round.maxE >= 5 && round.firstHit > 1, 'yard: a wave comes and reaches the player', round.maxE + ' enemies, first hit after ' + round.firstHit.toFixed(1) + ' s');
        ok(round.reach > round.free * 0.9, 'yard: nearly every free spot of the map can be reached', round.reach + ' of ' + round.free + ' cells');
        // the arms, hands and gun: one animated model in front of the camera, with a clip for each thing the player does
        const arms = await page.evaluate(() => {
            const H = window.__proof, Y = H.App.modes.yard, out = { has: !!Y.vm }; if (!Y.vm) return out;
            H.App.demo = false; H.App.locked = true; Y.start(false); const P = Y.P, gl = H.R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
            out.clips = Object.keys(Y.vm.clips).sort().join(','); out.bones = Y.A.skins.viewmodel.bones.length; out.first = P.vm.cur;
            H.step(1 / 30, 40); out.idle = P.vm.cur;
            // how much of the lower half of the picture the model covers: draw with and without it
            const grab = () => { H.step(1e-4, 1); const px = new Uint8Array(w * (h >> 1) * 4); gl.readPixels(0, 0, w, h >> 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
            const a = grab(); for (const m of Y.vm.node.children) m.visible = false; const b = grab(); for (const m of Y.vm.node.children) m.visible = true;
            let diff = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) diff++; out.cover = diff / (a.length / 4);
            H.mouse.down = true; H.step(1 / 60, 2); out.fire = P.vm.cur; H.mouse.down = false; H.step(1 / 30, 20); out.afterFire = P.vm.cur;
            H.keys.KeyR = true; H.step(1 / 30, 2); H.keys.KeyR = false; out.reload = P.vm.cur; out.reloadTime = P.reload;
            H.step(1 / 30, 12); const mid = grab(); let moved = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - mid[i]) + Math.abs(a[i + 1] - mid[i + 1]) + Math.abs(a[i + 2] - mid[i + 2]) > 24) moved++; out.moved = moved / (a.length / 4);
            H.step(1 / 30, Math.ceil(out.reloadTime * 30) + 15); out.ammo = P.ammo; out.end = P.vm.cur;
            H.keys.ShiftLeft = true; H.keys.KeyW = true; H.step(1 / 30, 15); out.run = P.vm.cur; H.keys.ShiftLeft = H.keys.KeyW = false;
            return out;
        });
        ok(arms.has && arms.clips === 'vm_draw,vm_fire,vm_idle,vm_reload,vm_run' && arms.bones >= 20, 'yard: the arms and gun are one rigged model with every clip', arms.has ? arms.bones + ' bones; ' + arms.clips : 'no "viewmodel" in the asset file');
        if (arms.has) {
            ok(arms.cover > 0.05 && arms.cover < 0.6, 'yard: the arms and gun fill their corner of the picture', (arms.cover * 100).toFixed(0) + '% of the lower half');
            ok(arms.first === 'vm_draw' && arms.idle === 'vm_idle' && arms.fire === 'vm_fire' && arms.afterFire === 'vm_idle', 'yard: draw, idle and fire clips play in turn', [arms.first, arms.idle, arms.fire, arms.afterFire].join(' > '));
            ok(arms.reload === 'vm_reload' && arms.reloadTime > 1.5 && arms.moved > 0.02 && arms.ammo === 30 && arms.end === 'vm_idle', 'yard: the reload is a clip of its own and the hands move', arms.reloadTime.toFixed(2) + ' s, ' + (arms.moved * 100).toFixed(0) + '% of the lower half changed');
            ok(arms.run === 'vm_run', 'yard: sprinting lowers the gun', arms.run);
        }
    }
    if (started) {          // the graphics context is lost and comes back: models, animation and pictures (fetched again) all return
        const before = await look(page);
        await page.evaluate(() => { const H = window.__proof; H.App.demo = true; H.App.modes.yard.start(true); H.step(1 / 30, 5); window.__lose = H.R.getContext().getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
        await page.waitForTimeout(300); await page.evaluate(() => window.__lose.restoreContext()); await page.waitForTimeout(1500);
        await page.evaluate(() => window.__proof.step(1 / 30, 3)); await page.waitForTimeout(1500);
        const after = await look(page), st = await page.evaluate(() => ({ failed: window.__proof.R.failed || null, mb: window.__proof.R.info.memory.textureBytes / 1048576 }));
        ok(!st.failed && after.colours > before.colours * 0.5 && st.mb > 20, 'yard: draws again after the graphics context was lost and restored', after.colours + ' colours (' + before.colours + ' before), ' + st.mb.toFixed(0) + ' MB of pictures back');
    }
    ok(!msgs.length, 'yard: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (want('tank')) {
    const q = opt('tank') ? '&tank=' + encodeURIComponent(opt('tank')) : '', { ctx, page, msgs } = await open(q);
    const started = await page.evaluate(() => window.__proof.start('tank', true));
    ok(started, 'tank: loads and starts', await page.evaluate(() => document.getElementById('load').textContent));
    if (started) {
        const L = await look(page); ok(L.colours > 40 && L.mean > 12 && L.mean < 245, 'tank: the picture is not blank', L.colours + ' colours, mean ' + L.mean.toFixed(0));
        if (opt('shot')) await page.screenshot({ path: opt('shot').replace(/\.png$/, '-tank.png') });
        await budgets(page, 'tank');
        const play = await page.evaluate(() => {
            const H = window.__proof, T = H.App.modes.tank, out = {}; H.App.demo = false; T.start(false);
            const K = T.K, x0 = K.x, z0 = K.z; H.keys.KeyW = true; H.step(1 / 30, 90); H.keys.KeyW = false;
            out.moved = Math.hypot(K.x - x0, K.z - z0); out.onGround = Math.abs(K.y - T.height(K.x, K.z)) < 0.6; out.y = K.y;
            const shells = T.fired; H.mouse.fired = true; H.App.locked = true; H.step(1 / 30, 1); out.fired = T.fired - shells; H.step(1 / 30, 240); out.craters = T.landed + T.hits;
            return out;
        });
        ok(play.moved > 5, 'tank: drives', play.moved.toFixed(1) + ' m in 3 s');
        ok(play.onGround, 'tank: follows the ground', 'height ' + play.y.toFixed(2));
        ok(play.fired === 1 && play.craters >= 1, 'tank: fires and the shell lands', play.fired + ' fired, ' + play.craters + ' landed');
        // aiming: the mouse moves the line of sight up and down as well as sideways, the gun follows it, the ring shows where
        // the shell will land and the shell lands there; a target can be found, laid on and knocked down
        const aim = await page.evaluate(() => {
            const H = window.__proof, T = H.App.modes.tank, out = {}; H.App.demo = false; H.App.locked = true; T.start(false); const K = T.K, deg = 57.3;
            const drag = (dx, dy, n) => { for (let i = 0; i < n; i++) { H.mouse.dx = dx; H.mouse.dy = dy; H.step(1 / 30, 1); } };
            H.step(1 / 30, 60); const el0 = K.elev, yaw0 = K.tyaw;
            drag(0, -6, 30); H.step(1 / 30, 60); out.up = (K.elev - el0) * deg; drag(0, 6, 70); H.step(1 / 30, 60); out.down = (K.elev - el0) * deg;
            drag(12, 0, 30); H.step(1 / 30, 90); out.turned = Math.abs(K.tyaw - yaw0) * deg;
            // the ground some way ahead: gun laid, ring on the cross, shell lands on the ring
            K.aimPitch = -0.1; H.step(1 / 30, 150); out.laid = K.laid; out.range = K.range; out.ringOff = Math.hypot(K.gx - K.ax, K.gy - K.ay, K.gz - K.az);
            const g = [K.gx, K.gy, K.gz], n0 = T.landed; H.mouse.fired = true; H.step(1 / 30, 1); for (let i = 0; i < 200 && T.landed === n0; i++) H.step(1 / 30, 1);
            out.landOff = T.lastLand ? Math.hypot(T.lastLand[0] - g[0], T.lastLand[1] - g[1], T.lastLand[2] - g[2]) : -1;
            // a target: look at it (the eye moves with the look, so settle in a few goes), wait for the gun, fire
            out.tried = 0; out.hit = false;
            for (const tg of T.targets) {
                out.tried++; const m = tg.mesh.matrixWorld.elements;
                for (let i = 0; i < 8; i++) { const e = T.eye.e; K.aimYaw = Math.atan2(m[12] - e[0], m[14] - e[2]); K.aimPitch = Math.atan2(m[13] - e[1], Math.hypot(m[12] - e[0], m[14] - e[2])); H.step(1 / 30, 1); }
                if (!K.aimHit || Math.hypot(K.ax - m[12], K.ay - m[13], K.az - m[14]) > 3) continue;        // something is in the way of this one
                H.step(1 / 30, 200); if (!K.laid) continue;
                const h0 = T.hits; H.mouse.fired = true; H.step(1 / 30, 1); for (let i = 0; i < 150 && T.hits === h0; i++) H.step(1 / 30, 1);
                out.hit = T.hits > h0; out.dist = Math.hypot(m[12] - K.x, m[14] - K.z); if (out.hit) break;
            }
            out.mark = getComputedStyle(document.getElementById('gunmark')).display;
            return out;
        });
        ok(aim.up > 3 && aim.down < -2, 'tank: the mouse lifts and dips the gun', '+' + aim.up.toFixed(1) + ' / ' + aim.down.toFixed(1) + ' degrees');
        ok(aim.turned > 10, 'tank: the mouse turns the turret', aim.turned.toFixed(0) + ' degrees');
        ok(aim.laid && aim.ringOff < 3, 'tank: the gun lays on the aim point', 'ring ' + aim.ringOff.toFixed(1) + ' m off at ' + aim.range.toFixed(0) + ' m');
        ok(aim.landOff >= 0 && aim.landOff < 3, 'tank: the shell lands where the ring said', aim.landOff.toFixed(1) + ' m off');
        ok(aim.hit, 'tank: a target can be aimed at and knocked down', 'tried ' + aim.tried + (aim.dist ? ', ' + aim.dist.toFixed(0) + ' m away' : ''));
        ok(aim.mark === 'block', 'tank: the gun ring is on the screen');
    }
    ok(!msgs.length, 'tank: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}

if (want('speed')) {
    const { ctx, page, msgs } = await open('&secs=3' + (opt('yard') ? '&yard=' + encodeURIComponent(opt('yard')) : ''));
    await page.evaluate(() => window.__proof.runTest('yard'));
    await page.waitForFunction(() => !!window.__proof.App.lastTest, null, { timeout: 60000 }).catch(() => { });
    const r = await page.evaluate(() => window.__proof.App.lastTest || null);
    ok(r && r.frames > 5 && r.ms > 0, 'speed test: runs and stores a result', r ? r.fps + ' FPS, ' + r.ms + ' ms work, ' + r.calls + ' draws (software graphics: not a real speed)' : 'no result');
    ok(await page.evaluate(() => !document.getElementById('menu').classList.contains('hidden') && document.getElementById('results').textContent.length > 10), 'speed test: back at the menu with the result shown');
    ok(!msgs.length, 'speed test: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}

// the processor's share of a frame with the main thread slowed six times (about a Chromebook's): the slice playing
// itself, every frame's own work timed. Drawing runs on software graphics here, so this is not a frame rate.
if (want('cpu')) {
    for (const name of ['yard', 'tank']) {
        const { ctx, page } = await open(opt(name) ? '&' + name + '=' + encodeURIComponent(opt(name)) : '');
        if (!await page.evaluate(n => window.__proof.start(n, true), name)) { ok(false, 'cpu: ' + name + ' starts'); await ctx.close(); continue; }
        await page.evaluate(() => { window.__proof.App.paused = true; window.__proof.step(1 / 30, 60); });
        const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
        const r = await page.evaluate(() => { const H = window.__proof, t = []; for (let i = 0; i < 200; i++) { const a = performance.now(); H.step(1 / 30, 1); t.push(performance.now() - a); } t.sort((a, b) => a - b); return { med: t[100], p95: t[190], calls: H.App.calls, tris: H.App.tris }; });
        ok(r.med < 12 && r.p95 < 22, 'cpu: ' + name + ' leaves room in a 33 ms frame on a slow processor', 'median ' + r.med.toFixed(1) + ' ms, 95% under ' + r.p95.toFixed(1) + ' ms (' + r.calls + ' draws, ' + Math.round(r.tris / 1000) + 'k triangles)');
        await ctx.close();
    }
}

// pixel cost on this computer's real graphics chip: an 8K picture (33 million pixels), each frame timed until the chip
// has finished it. Not a Chromebook's speed: a number to compare slices and games with (bench3d.mjs --mode gpu).
if (parts.includes('gpu')) {
    const real = await chromium.launch({ args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
    for (const name of ['yard', 'tank']) {
        const { ctx, page } = await open('&pr=4' + (opt(name) ? '&' + name + '=' + encodeURIComponent(opt(name)) : ''), real, { width: 1920, height: 1080 });
        if (!await page.evaluate(n => window.__proof.start(n, true), name)) { ok(false, 'gpu: ' + name + ' starts'); await ctx.close(); continue; }
        const r = await page.evaluate(async () => { const H = window.__proof, gl = H.R.getContext(), px = new Uint8Array(4), t = []; H.App.paused = true; H.step(1 / 30, 90);
            for (let i = 0; i < 160; i++) { const a = performance.now(); H.step(1 / 30, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - a); if (i % 16 === 15) await new Promise(r => setTimeout(r, 0)); }
            t.sort((a, b) => a - b); return { med: t[80], p95: t[152], w: gl.drawingBufferWidth, h: gl.drawingBufferHeight, gpu: (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() }; });
        ok(r.med > 0, 'gpu: ' + name + ' at ' + r.w + 'x' + r.h, 'median ' + r.med.toFixed(1) + ' ms, 95% under ' + r.p95.toFixed(1) + ' ms = ' + (r.med / (r.w * r.h / 1e6)).toFixed(2) + ' ms per million pixels  [' + r.gpu.slice(0, 60) + ']');
        await ctx.close();
    }
    await real.close();
}

// the paste-in loader (Proof Slice/loader.html), run the way jsfiddle runs it: from another address, with the CDN played
// by this checkout. Builds proof1 and proof2 exist, proof3 does not; the first mirror is dead.
if (want('loader')) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), msgs = [], asked = [];
    page.on('pageerror', e => msgs.push('error: ' + e.message.slice(0, 200))); page.on('console', m => { if (/\[HG3D\]/.test(m.text()) || (m.type() === 'error' && !/Failed to load resource/.test(m.text()))) msgs.push(m.text().slice(0, 240)); });
    const code = fs.readFileSync(opt('code') || path.join(ROOT, 'Proof Slice/loader.html'));     // --code=file: a copy taken back out of the doc
    await page.route('https://fiddle.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: code }));
    const live = args.includes('--live');       // --live: the real CDN and whatever build is newest there
    if (!live) await page.route(/^https:\/\/\w+\.jsdelivr\.net\//, r => {
        const u = new URL(r.request().url()), m = /^\/gh\/hunterefstration\/huntington-games@proof(\d+)\/(.*)$/.exec(decodeURIComponent(u.pathname)); asked.push(u.host + (m ? ' ' + m[1] + ' ' + m[2] : ' ?'));
        if (!m || +m[1] > 2) return r.fulfill({ status: 404, body: 'no such tag', headers: { 'access-control-allow-origin': '*' } });
        if (u.host === 'cdn.jsdelivr.net' && /index\.html$/.test(m[2])) return r.abort();
        const file = path.join(ROOT, m[2]); if (!fs.existsSync(file)) return r.fulfill({ status: 404, body: 'not found', headers: { 'access-control-allow-origin': '*' } });
        r.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'access-control-allow-origin': '*', 'content-type': /\.html$/.test(file) ? 'text/html' : /\.json$/.test(file) ? 'application/json' : /\.webp$/.test(file) ? 'image/webp' : 'application/octet-stream' } });
    });
    await page.goto('https://fiddle.test/show', { waitUntil: 'load' });
    let up = await page.waitForFunction(() => !!window.__proof || !!window.__ash, null, { timeout: 20000 }).then(() => true, () => false);
    // from build 3 the slice's page hands over to Ashfall (tools/tests/ashfall.mjs loader checks that side)
    if (up && await page.evaluate(() => !window.__proof)) { ok(true, 'loader: the newest build hands the page over to Ashfall'); up = false; await ctx.close(); } else
    { ok(up, 'loader: the slice starts from the pasted code', up ? '' : asked.slice(-4).join(', ')); }
    if (up) {
        const v = await page.evaluate(() => ({ build: window.HG_PROOF, base: window.HG_BASE, at: location.host }));
        ok(live ? v.build >= 1 : v.build === 2, 'loader: picks the newest build', 'build ' + v.build);
        ok((live ? /^https:\/\/\w+\.jsdelivr\.net\/gh\/.*@proof\d+\/Proof%20Slice\/$/ : /^https:\/\/fastly\.jsdelivr\.net\/gh\/.*@proof2\/Proof%20Slice\/$/).test(v.base) && v.at === 'fiddle.test', live ? 'loader: runs from the CDN at another address' : 'loader: a dead mirror is skipped', v.base);
        for (const name of ['yard', 'tank']) {
            const r = await page.evaluate(async n => { const H = window.__proof; const good = await H.start(n, true); H.step(1 / 30, 30); return { good, calls: H.App.calls, errors: H.App.errors.slice(0, 3) }; }, name);
            ok(r.good && r.calls > 5 && !r.errors.length, 'loader: the ' + name + ' loads its models and pictures from the CDN', r.calls + ' draws ' + r.errors.join(' | '));
        }
        if (!live) ok(asked.some(a => /^fastly\S* 2 Proof Slice\/assets\/yard\.hgm$/.test(a)) && asked.some(a => /^fastly.*range_tank\.webp$/.test(a)), 'loader: assets come from the mirror that worked');
        await page.evaluate(() => { localStorage.setItem('hgdev_proof', JSON.stringify({ yard: { fps: 58, low: 41, ms: 3.1, calls: 16, tris: 87000, mb: 67, scale: 1, w: 960, h: 540 } })); window.__proof.toMenu(); });
        const rep = await page.evaluate(() => document.getElementById('report').textContent);
        ok(/^Report: build \d+ \| yard 58\/41 fps/.test(rep), 'loader: the menu shows a report line to copy', rep.slice(0, 110));
    }
    ok(!msgs.length, 'loader: no script error', msgs.slice(0, 3).join(' | '));
    await ctx.close().catch(() => { });
}
await browser.close(); server.close();
console.log(fails ? fails + ' FAILED' : 'proof: all passed');
process.exit(fails ? 1 : 0);
