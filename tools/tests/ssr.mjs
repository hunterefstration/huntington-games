// Steel Storm Remastered (the proving ground) test. Needs no rig and no internet.
//   node tools/tests/ssr.mjs
// Checks: the skirmish loads and draws within the Chromebook budgets; the mouse lifts and turns the gun; the shell lands
// where the ring says; hostile tanks come, drive and shoot; armour decides what a hit does; a wave clears; being knocked
// out ends the run with a result that is saved; the menu opens.
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const BUDGET = { calls: 150, tris: 150000, mb: 100 };
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
let fails = 0; const ok = (c, what, info) => { console.log((c ? 'PASS  ' : 'FAIL  ') + what + (info !== undefined && info !== '' ? '  ' + info : '')); if (!c) fails++; };
async function open(query) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), msgs = [];
    page.on('pageerror', e => msgs.push('error: ' + e.message.slice(0, 200))); page.on('console', m => { if (/\[HG3D\]/.test(m.text()) || (m.type() === 'error' && !/Failed to load resource/.test(m.text()))) msgs.push(m.text().slice(0, 240)); });
    await page.goto(base + '/Steel%20Storm%20Remastered/index.html?gov=0&' + query, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => !!window.__ssr, null, { timeout: 15000 });
    return { ctx, page, msgs };
}
{
    const { ctx, page, msgs } = await open('go=1&ground=range');          // the flat ground: on a hilly one a shell rightly meets a crest before the aim point
    const started = await page.waitForFunction(() => window.__ssr.started !== undefined, null, { timeout: 60000 }).then(() => page.evaluate(() => window.__ssr.started), () => false);
    ok(started, 'a skirmish loads and starts', started ? '' : await page.evaluate(() => window.__ssr.App.errors.join(' | ')));
    if (started) {
        const s = await page.evaluate(() => {
            const H = window.__ssr, G = H.Game, P = G.P, out = {}, deg = 57.3; H.App.locked = true;
            const go = n => { for (let i = 0; i < n; i++) { P.hp = P.max; H.step(1 / 30, 1); } }, drag = (dx, dy, n) => { for (let i = 0; i < n; i++) { H.mouse.dx = dx; H.mouse.dy = dy; P.hp = P.max; H.step(1 / 30, 1); } };
            go(30); const el0 = P.elev, ty0 = P.tyaw;
            drag(0, -6, 30); go(60); out.up = (P.elev - el0) * deg; drag(0, 6, 70); go(60); out.down = (P.elev - el0) * deg; drag(12, 0, 30); go(90); out.turned = Math.abs(P.tyaw - ty0) * deg;
            // the ground ahead: gun laid, the ring on the aim point, the shell lands on the ring
            G.aimPitch = -0.1; go(150); out.laid = P.laid; const g = [0, 0, 0]; H.Units.fall(P, g); out.ringOff = Math.hypot(g[0] - G.ax, g[1] - G.ay, g[2] - G.az);
            let land = null; const old = G.landed; G.landed = s => { if (s.by === P) land = [s.x, s.y, s.z]; }; H.mouse.fired = true; go(1); for (let i = 0; i < 200 && !land; i++) go(1); G.landed = old; out.landOff = land ? Math.hypot(land[0] - g[0], land[2] - g[2]) : -1;
            // the first wave: hostile tanks, they move and they shoot
            for (let i = 0; i < 300 && G.wave < 1; i++) go(1); out.wave = G.wave; const E = G.enemies(); out.enemies = E.length; const p0 = E.map(U => [U.x, U.z]); let shells = 0, calls = 0, tris = 0;
            for (let i = 0; i < 400; i++) { go(1); calls = Math.max(calls, H.App.calls); tris = Math.max(tris, H.App.tris); if (H.Units.shells.some(s => s.by !== P)) shells++; }
            out.moved = E.reduce((a, U, i) => a + Math.hypot(U.x - p0[i][0], U.z - p0[i][1]), 0); out.enemyFire = shells; out.calls = calls; out.tris = tris; out.mb = H.R.info.memory.textureBytes / 1048576;
            // armour: the same shell does more to the rear than to the front, and glances off at a shallow angle
            const U = E[0]; U.yaw = 0; U.up = [0, 1, 0]; H.Units.place(U); const st = (px, pz, dx, dz) => H.Units.strike(U, U.x + px, U.y + 1, U.z + pz, dx, 0, dz);          // where on the hull, flying which way
            out.front = st(0, 3.3, 0, -1).part; out.rear = st(0, -3.3, 0, 1).part; out.side = st(1.7, 0, -1, 0).part; out.square = st(0, 3.3, 0, -1).square; out.glance = st(1, 3.3, -0.97, -0.24).square;
            const h0 = U.hp; H.Units.damage(U, 300, P, G, 'SIDE HIT'); out.dmg = h0 - U.hp; out.hits = G.hits;
            // knock out every hostile tank: the wave clears and pays
            for (const X of G.enemies()) H.Units.damage(X, 99999, P, G, 'REAR HIT'); go(5); out.kills = G.kills; out.phase = G.phase; out.score = G.score;
            return out;
        });
        ok(s.up > 3 && s.down < -2, 'the mouse lifts and dips the gun', '+' + s.up.toFixed(1) + ' / ' + s.down.toFixed(1) + ' degrees');
        ok(s.turned > 10, 'the mouse turns the turret', s.turned.toFixed(0) + ' degrees');
        ok(s.laid && s.ringOff < 3, 'the gun lays on the aim point', 'ring ' + s.ringOff.toFixed(1) + ' m off');
        ok(s.landOff >= 0 && s.landOff < 3, 'the shell lands where the ring said', s.landOff.toFixed(1) + ' m off');
        ok(s.wave === 1 && s.enemies >= 2, 'the first wave brings hostile tanks', s.enemies + ' tanks');
        ok(s.moved > 10 && s.enemyFire > 0, 'they drive and they shoot', 'moved ' + s.moved.toFixed(0) + ' m, shells in the air on ' + s.enemyFire + ' frames');
        ok(s.calls <= BUDGET.calls && s.tris <= BUDGET.tris && s.mb <= BUDGET.mb, 'budgets hold with tanks on the field', s.calls + ' draws, ' + Math.round(s.tris / 1000) + 'k triangles, ' + s.mb.toFixed(0) + ' MB');
        ok(s.front === 'front' && s.rear === 'rear' && s.side === 'side' && s.square > 0.9 && s.glance < 0.34, 'armour: front, side, rear, and a shallow hit glances', s.front + ', ' + s.side + ', ' + s.rear + ', squareness ' + s.glance.toFixed(2));
        ok(s.dmg === 300 && s.kills >= 2 && s.phase === 'break' && s.score > 0, 'knocking them all out clears the wave and scores', s.kills + ' kills, score ' + s.score);
        // after the wave: one of three field jobs is picked, and it changes the tank
        const up = await page.evaluate(() => { const H = window.__ssr, G = H.Game, P = G.P; for (let i = 0; i < 70; i++) { P.hp = P.max; H.step(1 / 30, 1); } const tiles = [...document.querySelectorAll('[data-up]')], open = G.shopOpen, before = JSON.stringify([P.max, P.k, G.kits]), t0 = G.phaseT; H.step(1 / 30, 30); const waits = G.phaseT === t0; if (tiles[0]) tiles[0].click(); return { n: tiles.length, open, waits, changed: JSON.stringify([P.max, P.k, G.kits]) !== before, shut: !G.shopOpen, ups: G.ups.length }; });
        ok(up.n === 3 && up.open && up.waits && up.changed && up.shut && up.ups === 1, 'a cleared wave offers three field upgrades, the next wave waits, the pick is applied', up.n + ' offered');
        const end = await page.evaluate(async () => { const H = window.__ssr, G = H.Game, P = G.P; H.Units.damage(P, 99999, null, G, 'FRONT HIT'); H.step(1 / 30, 120); await new Promise(r => setTimeout(r, 300)); const sv = JSON.parse(localStorage.getItem('steelstorm_remaster') || '{}'); return { dead: P.dead, over: G.over, shown: !document.getElementById('results').classList.contains('hidden'), best: sv.stats && sv.stats.bestScore, errors: H.App.errors.slice(0, 3) }; });
        ok(end.dead && end.over && end.shown && end.best > 0 && !end.errors.length, 'being knocked out ends the run, shows the result and saves the best', 'best ' + end.best + ' ' + end.errors.join(' | '));
        const again = await page.evaluate(() => { const H = window.__ssr; document.querySelector('[data-do=again]').click(); H.App.locked = true; H.step(1 / 30, 20); return { over: H.Game.over, hp: H.Game.P.hp, units: H.Units.list.length }; });
        ok(!again.over && again.hp === 1000 && again.units === 1, 'GO AGAIN starts fresh');
    }
    ok(!msgs.length, 'quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}
// the frame outside a battle: the bar, the pages, the garage and the research tree, then a battle of each team kind
{
    const { ctx, page, msgs } = await open('menu=1');
    const m = await page.evaluate(async () => {
        const H = window.__ssr, sv = H.Save.data, sleep = ms => new Promise(r => setTimeout(r, ms)), click = s => { const b = document.querySelector(s); if (!b || b.disabled) return false; b.click(); return true; }, out = {};
        for (let i = 0; i < 160 && !H.World.loaded; i++) await sleep(250); H.step(1 / 30, 5);
        out.loaded = H.World.loaded; out.calls = H.App.calls; out.tabs = document.querySelectorAll('#tabs button').length; out.show = H.Units.list.length; out.showKind = H.Units.show && H.Units.show.kind; out.home = document.getElementById('page').textContent.length;
        click('[data-tab=settings]'); out.set = document.getElementById('panel-body').textContent.length; document.getElementById('panel-x').click();
        // research: points open a vehicle, credits buy it, it becomes the one in the garage and behind the menu
        sv.rp = 5000; sv.cr = 60000; click('[data-tab=research]'); out.cells = document.querySelectorAll('.cell').length; click('[data-res=mt2]'); out.res = click('[data-do=research]') && !!sv.res.mt2; out.buy = click('[data-do=buy]') && !!sv.own.mt2; out.veh = sv.veh; out.locked = !click('[data-res=mt4]') || !document.querySelector('[data-do=research]');
        click('[data-res=td1]'); click('[data-do=research]'); click('[data-do=buy]'); out.td = !!sv.own.td1;
        H.step(1 / 30, 3); out.showKind2 = H.Units.show && H.Units.show.kind; out.tdModel = H.Units.show && H.Units.show.pre;
        click('[data-tab=garage]'); click('[data-veh=mt2]'); const cr = sv.cr; out.mod = click('[data-mod=armour]') && sv.mods.mt2.armour === 1 && sv.cr < cr; H.step(1 / 30, 3); out.modHp = H.Units.show.max;
        return out;
    });
    ok(m.loaded && m.calls > 3 && m.tabs === 5 && m.show === 1 && m.showKind === 'mt1' && m.home > 100 && m.set > 100, 'the frame: a bar of five pages over the chosen vehicle on its ground; settings open', m.calls + ' draws');
    ok(m.cells === 30 && m.res && m.buy && m.veh === 'mt2' && m.locked, 'research: thirty vehicles; points open one, credits buy it, the tier after next stays shut', m.cells + ' in the tree');
    ok(m.td && m.showKind2 === 'td1' && m.tdModel === 'td', 'a bought tank destroyer stands behind the menu as its own model', m.showKind2 + ' drawn as ' + m.tdModel);
    ok(m.mod && m.modHp > 1240 * 1.06, 'garage: a module is bought and the vehicle is better for it', 'hull ' + Math.round(m.modHp));
    const b = await page.evaluate(async () => {
        const H = window.__ssr, out = {}, click = s => { const x = document.querySelector(s); if (!x || x.disabled) return false; x.click(); return true; };
        click('[data-tab=battle]'); out.modes = document.querySelectorAll('[data-mode]').length; click('[data-mode=tdm]'); click('[data-size="4"]'); click('[data-skill=easy]'); click('[data-do=deploy]');
        for (let i = 0; i < 300 && !H.App.game; i++) await new Promise(r => setTimeout(r, 100)); if (!H.App.game) return out;
        const G = H.Game; H.App.locked = true; out.mode = G.mode; out.roster = G.roster.length; out.mine = G.roster.filter(r => r.team === 0).length; out.veh = G.P.kind; out.kinds = [...new Set(G.roster.map(r => H.VEHS[r.veh].br))].length;
        let calls = 0, shells = 0, hurt = 0; const p0 = G.roster.map(r => [r.U.x, r.U.z]);
        for (let i = 0; i < 900; i++) { G.P.hp = G.P.max; H.step(1 / 30, 1); calls = Math.max(calls, H.App.calls); shells = Math.max(shells, H.Units.shells.length); }
        out.calls = calls; out.shells = shells; out.moved = G.roster.reduce((a, r, i) => a + Math.hypot(r.U.x - p0[i][0], r.U.z - p0[i][1]), 0); out.dealt = G.roster.reduce((a, r) => a + r.score, 0);
        // knock out an enemy as the player: it is counted, and its crew comes back
        const foe = G.roster.find(r => r.team === 1 && !r.U.dead), fU = foe.U, k0 = G.score2[0]; H.Units.damage(fU, 99999, G.P, G, 'REAR HIT'); out.kill = G.score2[0] - k0; out.fd = foe.deaths; for (let i = 0; i < 230; i++) { G.P.hp = G.P.max; H.step(1 / 30, 1); } out.back = foe.U !== fU && !foe.U.dead;
        // the player is knocked out, waits, and gets a new tank
        const mine = G.P; H.Units.damage(mine, 99999, foe.U, G, 'FRONT HIT'); out.dead = G.P.dead && !G.over; for (let i = 0; i < 230; i++) H.step(1 / 30, 1); out.again = G.P !== mine && !G.P.dead;
        // enough kills end it and pay
        const sv = H.Save.data, rp = sv.rp, cr = sv.cr; G.score2[0] = G.need; H.step(1 / 30, 2); out.over = G.over; out.title = G.result && G.result.title; out.paid = sv.rp > rp && sv.cr > cr; for (let i = 0; i < 120; i++) H.step(1 / 30, 1); out.shown = !document.getElementById('results').classList.contains('hidden') && document.querySelectorAll('.boards tr').length;
        document.querySelector('[data-do=tomenu]').click(); out.menu = H.App.screen === 'menu' && !H.App.game;
        return out;
    });
    ok(b.modes === 3 && b.mode === 'tdm' && b.roster === 8 && b.mine === 4 && b.veh === 'mt2' && b.kinds >= 2, 'team battle: four a side in vehicles of the tree, you in yours', b.roster + ' crews, ' + b.kinds + ' kinds');
    ok(b.moved > 60 && b.shells > 0 && b.dealt > 0, 'team battle: both sides drive, shoot and hurt each other', 'moved ' + Math.round(b.moved) + ' m, score dealt ' + Math.round(b.dealt));
    ok(b.kill === 1 && b.fd === 1 && b.back, 'team battle: a kill is counted and the crew comes back in a new tank');
    ok(b.dead && b.again, 'team battle: knocked out, you come back too');
    ok(b.over && b.title === 'VICTORY' && b.paid && b.shown >= 10 && b.menu, 'team battle: enough kills win it, it pays research and credits, the boards are shown', b.shown + ' rows');
    ok(b.calls <= BUDGET.calls, 'team battle: draw calls within budget with eight tanks', b.calls + ' of ' + BUDGET.calls);
    const c = await page.evaluate(async () => {
        const H = window.__ssr, out = {}, click = s => { const x = document.querySelector(s); if (!x || x.disabled) return false; x.click(); return true; };
        click('[data-tab=battle]'); click('[data-mode=conq]'); click('[data-do=deploy]'); for (let i = 0; i < 300 && !H.App.game; i++) await new Promise(r => setTimeout(r, 100)); if (!H.App.game) return out;
        const G = H.Game; H.App.locked = true; out.points = G.points.length; out.beams = H.Beams.list.length; const p = G.points[0], t0 = G.tickets[1];
        // sit in a ring with nobody else near: it becomes ours, and the other side bleeds
        for (const r of G.roster) if (!r.me) { r.U.x = G.base[r.team][0]; r.U.z = G.base[r.team][1]; r.U.ai = null; }
        for (let i = 0; i < 500 && p.own !== 0; i++) { G.P.x = p.x; G.P.z = p.z; G.P.hp = G.P.max; H.step(1 / 30, 1); } out.own = p.own; out.caps = G.caps;
        for (let i = 0; i < 200; i++) { G.P.x = p.x; G.P.z = p.z; G.P.hp = G.P.max; H.step(1 / 30, 1); } out.bled = t0 - G.tickets[1];
        G.tickets[1] = 0.01; for (let i = 0; i < 10; i++) H.step(1 / 30, 1); out.over = G.over; out.title = G.result && G.result.title; out.errors = H.App.errors.slice(0, 3);
        return out;
    });
    ok(c.points === 3 && c.beams === 3 && c.own === 0 && c.caps === 1, 'conquest: three rings; sitting in one alone makes it yours', 'ring owner ' + c.own);
    ok(c.bled > 0.5 && c.over && c.title === 'VICTORY' && !(c.errors || []).length, 'conquest: holding more bleeds their tickets, and none left ends it', 'bled ' + (c.bled || 0).toFixed(1) + ' ' + (c.errors || []).join(' | '));
    ok(!msgs.length, 'menu and battles: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}
// every kind of vehicle does what its kind does
{
    const { ctx, page, msgs } = await open('go=1&ground=range&veh=spaa1');
    await page.waitForFunction(() => window.__ssr.started !== undefined, null, { timeout: 90000 }).catch(() => { });
    const k = await page.evaluate(() => {
        const H = window.__ssr, G = H.Game, out = {}; H.App.locked = true; let P = G.P; const run = n => { for (let i = 0; i < n; i++) { G.P.hp = G.P.max; G.phaseT = 99; H.step(1 / 30, 1); } };
        out.kind = P.kind; out.auto = P.k.auto; out.model = P.pre; H.mouse.down = true; run(45); H.mouse.down = false; out.burst = G.shots;
        const mk = id => { H.Units.clear(); const U = H.Units.make(0, P.x, P.z, 0, id); G.P = U; U.reload = 0; return U; };
        let U = mk('td1'); out.tdArc = U.k.arc; out.tdModel = U.pre; G.aimYaw = 1.5; run(120); out.tdTurret = Math.abs(U.tyaw); out.tdStop = U.stop;
        U = mk('arty1'); out.artyModel = U.pre; out.artyShell = U.shellType; G.aimYaw = 0; G.aimPitch = -0.12; run(150); H.mouse.fired = true; run(1); const s = H.Units.shells[0]; out.artyV = s ? Math.hypot(s.vx, s.vy, s.vz) : 0;
        U = mk('lt5'); out.lt5 = [Math.round(U.max), U.k.speed.toFixed(2)]; U = mk('ht5'); out.ht5 = [Math.round(U.max), U.k.speed.toFixed(2)]; out.errors = H.App.errors.slice(0, 3);
        return out;
    });
    ok(k.kind === 'spaa1' && k.auto && k.burst >= 5 && k.model === 'spaa', 'anti-air: its own model, and the trigger can be held', k.burst + ' shells in a second and a half');
    ok(k.tdArc > 0 && k.tdTurret <= k.tdArc + 0.001 && k.tdStop && k.tdModel === 'td', 'tank destroyer: the gun stops at the end of its arc', 'arc ' + k.tdArc + ', gun at ' + (k.tdTurret || 0).toFixed(2));
    ok(k.artyModel === 'arty' && k.artyShell === 'hh' && k.artyV > 80 && k.artyV < 110, 'artillery: its own model, a slow heavy shell', Math.round(k.artyV) + ' m/s');
    ok(k.ht5[0] > k.lt5[0] * 1.8 && +k.lt5[1] > +k.ht5[1] * 1.5 && !k.errors.length, 'tiers and branches differ: a tier V heavy against a tier V light', 'hull ' + k.ht5[0] + ' / ' + k.lt5[0] + ', speed ' + k.ht5[1] + ' / ' + k.lt5[1]);
    ok(!msgs.length, 'vehicles: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}
// the big terrain, with a model for each kind of tank
{
    const { ctx, page, msgs } = await open('go=1&ground=valley');
    const started = await page.waitForFunction(() => window.__ssr.started !== undefined, null, { timeout: 90000 }).then(() => page.evaluate(() => window.__ssr.started), () => false);
    ok(started, 'valley: loads and starts', started ? '' : await page.evaluate(() => window.__ssr.App.errors.join(' | ')));
    if (started) {
        const v = await page.evaluate(() => {
            const H = window.__ssr, G = H.Game, P = G.P; H.App.locked = true; let calls = 0, tris = 0; const st = n => { for (let i = 0; i < n; i++) { P.hp = P.max; H.step(1 / 30, 1); calls = Math.max(calls, H.App.calls); tris = Math.max(tris, H.App.tris); } };
            st(160); const x0 = P.x, z0 = P.z; H.keys.KeyW = true; st(180); H.keys.KeyW = false; const drove = Math.hypot(P.x - x0, P.z - z0), E = G.enemies(), p0 = E.map(U => [U.x, U.z]); st(200);
            const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), L = H.Units.make(1, P.x + fx * 40, P.z + fz * 40, 0, 'light'), Hv = H.Units.make(1, P.x + fx * 60, P.z + fz * 60, 0, 'heavy'); H.Units.brain(L, 0.2); H.Units.brain(Hv, 0.2); st(30);
            return { map: H.World.id, size: H.World.size, drove, moved: E.reduce((a, U, i) => a + Math.hypot(U.x - p0[i][0], U.z - p0[i][1]), 0), enemies: E.length, own: [L.pre, Hv.pre].join(','), lens: [L.half[1], P.half[1], Hv.half[1]], lit: P.light[0] + P.light[1] + P.light[2], calls, tris, mb: H.R.info.memory.textureBytes / 1048576, errors: H.App.errors.slice(0, 3) };
        });
        ok(v.map === 'valley' && v.size > 300 && v.lit > 0.2, 'valley: the big ground is the one loaded, and the tank on it is lit', Math.round(v.size) + ' m');
        ok(v.drove > 20 && v.enemies >= 2 && v.moved > 10, 'valley: the player drives off from the start and the enemy closes in', 'drove ' + v.drove.toFixed(0) + ' m, they moved ' + v.moved.toFixed(0) + ' m');
        ok(v.own === 'light,heavy' && v.lens[0] < v.lens[1], 'valley: light and heavy tanks have their own models', v.own + ', hull half-lengths ' + v.lens.map(x => x.toFixed(1)).join(' / '));
        ok(v.calls <= BUDGET.calls && v.tris <= BUDGET.tris && v.mb <= BUDGET.mb && !v.errors.length, 'valley: within the budgets', v.calls + ' draws, ' + Math.round(v.tris / 1000) + 'k triangles, ' + v.mb.toFixed(0) + ' MB ' + v.errors.join(' | '));
    }
    ok(!msgs.length, 'valley: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}
await browser.close(); server.close();
console.log(fails ? fails + ' FAILED' : 'ssr: all passed');
process.exit(fails ? 1 : 0);
