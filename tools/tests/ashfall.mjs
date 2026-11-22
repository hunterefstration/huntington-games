// Ashfall test. Needs no rig. Parts: solo, soak, maps, ui (no internet needed), mp (two browsers through the real PeerJS matchmaking
// server and WebRTC: needs internet; named, or run with everything).
//   node tools/tests/ashfall.mjs            solo + ui + mp
//   node tools/tests/ashfall.mjs solo ui    only these (solo, ui, mp, loader; "loader --live" = the real CDN, after a test build is published)
// Checks: a run starts and draws within the Chromebook budgets; the gun fires, reloads, aims with E; waves come, pay and
// end; the supply crate sells; a run ends with a result and is saved; the opening types its lines and shows the name;
// the menu and its panels open; two players find each other with a code, see each other and the same ashen, and a
// deathmatch with bots keeps score.
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const args = process.argv.slice(2), parts = args.filter(a => !a.startsWith('--')), want = p => !parts.length || parts.includes(p);
const BUDGET = { calls: 150, tris: 150000, mb: 100 };
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
let fails = 0; const ok = (c, what, info) => { console.log((c ? 'PASS  ' : 'FAIL  ') + what + (info !== undefined && info !== '' ? '  ' + info : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function open(query, size) {
    const ctx = await browser.newContext({ viewport: size || { width: 960, height: 540 } }), page = await ctx.newPage(), msgs = [];
    page.on('pageerror', e => msgs.push('error: ' + e.message.slice(0, 200))); page.on('console', m => { if (/\[HG3D\]/.test(m.text()) || (m.type() === 'error' && !/Failed to load resource/.test(m.text()))) msgs.push(m.text().slice(0, 240)); });
    await page.goto(base + '/Ashfall/index.html?gov=0&' + (query || ''), { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => !!window.__ash, null, { timeout: 45000 });
    return { ctx, page, msgs };
}
const errs = page => page.evaluate(() => window.__ash.App.errors.slice(0, 3).join(' | '));

if (want('solo')) {
    const { ctx, page, msgs } = await open('go=yard');
    const started = await page.waitForFunction(() => window.__ash.started !== undefined, null, { timeout: 60000 }).then(() => page.evaluate(() => window.__ash.started), () => false);
    ok(started, 'solo: a run loads and starts', started ? '' : await errs(page));
    if (started) {
        const s = await page.evaluate(() => {
            const H = window.__ash, G = H.Game, P = G.P, out = {}; H.App.locked = true; let calls = 0, tris = 0;
            const go = (dt, n) => { for (let i = 0; i < n; i++) { P.hp = P.max; H.step(dt, 1); } };          // nothing may kill the player while the gun is tried out
            // through the first break into wave 1 with a full yard
            for (let i = 0; i < 400; i++) { H.step(1 / 30, 1); calls = Math.max(calls, H.App.calls); tris = Math.max(tris, H.App.tris); P.hp = P.max; }
            out.calls = calls; out.tris = tris; out.mb = H.R.info.memory.textureBytes / 1048576; out.wave = G.wave; out.foes = H.Foes.list.length; out.gun = H.Gun.cur && H.Gun.cur.id; out.clips = Object.keys(H.Gun.cur.clips).sort().join(',');
            // the picture is not blank
            const gl = H.R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); H.step(1e-4, 1); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); const seen = new Set(); for (let i = 0; i < px.length; i += 4 * 97) seen.add((px[i] >> 3) << 10 | (px[i + 1] >> 3) << 5 | px[i + 2] >> 3); out.colours = seen.size;
            // fire: ammo goes down, a casing flies; aim with E: the view narrows; reload: the clip plays and the magazine fills
            const a0 = H.Gun.S.ammo; H.mouse.down = true; go(1 / 60, 20); H.mouse.down = false; out.fired = a0 - H.Gun.S.ammo; out.brass = H.World.brass.count;
            dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); go(1 / 30, 20); out.ads = P.ads; out.fov = H.World.camera.fov;
            dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); go(1 / 30, 20); out.adsOff = P.ads;
            H.hit.KeyR = true; go(1 / 30, 2); out.reloading = P.vm.cur; go(1 / 30, 90); out.ammo = H.Gun.S.ammo; out.mag = H.Gun.W.mag;
            // kill everything of this wave by hand: cash, kills, the wave clears and the crate opens
            let guard = 0; while (G.phase === 'fight' && guard++ < 400) { for (const e of H.Foes.list.slice()) if (e.state !== 'die') H.Foes.damage(e, 9999, true, G, 0); P.hp = P.max; H.step(1 / 30, 3); }
            out.phase = G.phase; out.cash = G.cash; out.kills = G.kills;
            H.hit.KeyB = true; H.step(1 / 30, 1); out.shop = G.shopOpen && !document.getElementById('shop').classList.contains('hidden');
            const c0 = G.cash; G.cash = 5000; document.querySelector('[data-tab=gear]').click(); document.querySelector('[data-buy=armor]').click(); out.armor = P.armor; out.paid = 5000 - G.cash;
            document.querySelector('[data-tab=perks]').click(); document.querySelector('[data-buy="perk:vital"]').click(); out.maxHp = P.max;
            document.querySelector('[data-tab=ups]').click(); document.querySelector('[data-buy="up:carbine"]').click(); out.lvl = H.Gun.state.carbine.lvl; out.mag2 = H.Gun.stats('carbine').mag;
            document.querySelector('[data-do=shopx]').click(); out.shopShut = !G.shopOpen; G.cash = c0;
            return out;
        });
        ok(s.wave >= 1 && s.foes > 0 && s.gun === 'carbine', 'solo: the first wave comes', 'wave ' + s.wave + ', ' + s.foes + ' ashen');
        ok(s.colours > 40, 'solo: the picture is not blank', s.colours + ' colours');
        ok(s.calls > 0 && s.calls <= BUDGET.calls, 'solo: draw calls within budget', s.calls + ' of ' + BUDGET.calls);
        ok(s.tris > 0 && s.tris <= BUDGET.tris, 'solo: triangles within budget', Math.round(s.tris) + ' of ' + BUDGET.tris);
        ok(s.mb <= BUDGET.mb, 'solo: picture memory within budget', s.mb.toFixed(0) + ' MB of ' + BUDGET.mb);
        ok(/vm_draw/.test(s.clips) && /vm_fire/.test(s.clips) && /vm_reload/.test(s.clips), 'solo: the gun has its clips', s.clips);
        ok(s.fired >= 2 && s.brass >= 1, 'solo: the gun fires and throws casings', s.fired + ' rounds, ' + s.brass + ' casings');
        ok(s.ads > 0.9 && s.fov < 60 && s.adsOff < 0.1, 'solo: E aims down the sight and E again lowers it', 'aim ' + s.ads.toFixed(2) + ', view ' + s.fov.toFixed(0) + ' degrees');
        ok(s.reloading === 'vm_reload' && s.ammo === s.mag, 'solo: R reloads', s.ammo + ' of ' + s.mag);
        ok(s.phase === 'break' && s.cash > 0 && s.kills > 0, 'solo: a cleared wave pays', '$' + s.cash + ', ' + s.kills + ' kills');
        ok(s.shop && s.armor === 50 && s.paid === 400 && s.maxHp === 125 && s.lvl === 1 && s.mag2 > 30 && s.shopShut, 'solo: the supply crate sells armour, perks and upgrades', 'armour ' + s.armor + ', max health ' + s.maxHp + ', magazine ' + s.mag2);
        const end = await page.evaluate(async () => {
            const H = window.__ash, G = H.Game, P = G.P, xp0 = H.Save.data.xp; G.hurt(0, 9999, P.x + 1, P.z, null); const dead = P.dead, over = G.over;
            H.step(1 / 30, 120); await new Promise(r => setTimeout(r, 500));
            const shown = !document.getElementById('results').classList.contains('hidden'), saved = JSON.parse(localStorage.getItem('ashfall_save') || '{}');
            return { dead, over, shown, xp: H.Save.data.xp - xp0, savedXp: saved.xp, best: saved.stats && saved.stats.best.yard_normal, text: document.getElementById('results').textContent.slice(0, 60) };
        });
        ok(end.dead && end.over && end.shown, 'solo: going down ends the run with a result', end.text);
        ok(end.xp > 0 && end.savedXp > 0 && end.best >= 1, 'solo: the run is saved (rank experience, best wave)', '+' + end.xp + ' XP, best wave ' + end.best);
        const again = await page.evaluate(() => { const H = window.__ash; document.querySelector('[data-do=again]').click(); H.App.locked = true; H.step(1 / 30, 30); return { wave: H.Game.wave, hp: H.Game.P.hp, over: H.Game.over, cash: H.Game.cash }; });
        ok(!again.over && again.hp === 100 && again.cash === 0, 'solo: GO AGAIN starts a fresh run');
    }
    ok(!msgs.length, 'solo: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}

// a long careless run: every key mashed, every weapon bought and fired, every kind of ashen met, through the first boss.
// Nothing may throw, and the budgets must hold with a full yard.
if (want('soak')) {
    const { ctx, page, msgs } = await open('go=yard&cls=recon');
    await page.waitForFunction(() => window.__ash.started !== undefined, null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
        const H = window.__ash, G = H.Game, P = G.P, out = { err: '', waves: 0, kinds: {}, guns: {}, calls: 0, tris: 0, bought: 0 }; H.App.locked = true; H.Save.data.xp = 1e6;      // every weapon unlocked
        const keysList = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'], taps = ['KeyR', 'KeyV', 'KeyG', 'KeyX', 'KeyC', 'KeyQ', 'Digit1', 'Digit2', 'Digit3', 'KeyE'];
        let rnd = 12345; const R = () => (rnd = rnd * 16807 % 2147483647) / 2147483647;
        try {
            for (let f = 0; f < 9000 && G.wave < 6 && !G.over; f++) {
                if (f % 20 === 0) { for (const k of keysList) H.keys[k] = R() < 0.4; H.mouse.down = R() < 0.6; }
                if (R() < 0.03) H.hit[taps[(R() * taps.length) | 0]] = true; if (R() < 0.01) H.Input.aimOn = !H.Input.aimOn;
                H.mouse.dx = (R() - 0.5) * 60; H.mouse.dy = (R() - 0.5) * 10; if (R() < 0.2) H.mouse.fired = true;
                P.hp = P.max; G.cash = 99999; G.nades = 4; G.abilT = Math.min(G.abilT, 1);
                // look at the nearest ashen now and then so things die, and help the wave along
                if (f % 7 === 0) { let bd = 1e9, b = null; for (const e of H.Foes.list) { if (e.state === 'die') continue; out.kinds[e.type] = 1; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } } if (b) { P.yaw = Math.atan2(-(b.x - P.x), -(b.z - P.z)); P.pitch = Math.atan2(1.2 * b.size - 1.65, bd); } }
                if (f % 90 === 0) for (const e of H.Foes.list.slice(0, 6)) if (e.state !== 'die' && !e.T.boss) H.Foes.damage(e, 400, R() < 0.3, G, 0);
                if (G.bossAlive && f % 30 === 0) H.Foes.damage(G.bossAlive, 500, false, G, 0);
                H.step(1 / 30, 1); out.calls = Math.max(out.calls, H.App.calls); out.tris = Math.max(out.tris, H.App.tris); if (H.Gun.cur) out.guns[H.Gun.cur.id] = 1;
                // each break: buy something of everything
                if (G.phase === 'break' && G.wave > 0 && !G.shopOpen && G.phaseT > 15) {
                    H.hit.KeyB = true; H.step(1 / 30, 1);
                    for (const tab of ['guns', 'ups', 'gear', 'perks']) { const t = document.querySelector('[data-tab=' + tab + ']'); if (!t) break; t.click(); const b = [...document.querySelectorAll('#shop [data-buy]:not([disabled])')]; if (b.length) { const pick = b[(R() * b.length) | 0], key = pick.dataset.buy; if (key.slice(0, 4) === 'gun:') await H.UI.buy(key); else pick.click(); out.bought++; } }
                    const x = document.querySelector('[data-do=shopx]'); if (x) x.click(); G.phaseT = 0.5; await new Promise(r => setTimeout(r, 600)); H.App.paused = false; H.App.locked = true;
                }
            }
        } catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
        out.waves = G.wave; out.kills = G.kills; out.mb = H.R.info.memory.textureBytes / 1048576; out.errors = H.App.errors.slice(0, 3); out.kinds = Object.keys(out.kinds).join(','); out.guns = Object.keys(out.guns).join(',');
        return out;
    });
    ok(!r.err && !r.errors.length, 'soak: nothing throws in a long careless run', r.err || r.errors.join(' | '));
    ok(r.waves >= 6, 'soak: it gets through the first boss wave', 'wave ' + r.waves + ', ' + r.kills + ' kills, met ' + r.kinds);
    ok(r.bought >= 8, 'soak: the crate is used every break', r.bought + ' purchases; guns held: ' + r.guns);
    ok(r.calls <= BUDGET.calls && r.tris <= BUDGET.tris && r.mb <= BUDGET.mb + 20, 'soak: budgets hold with a full yard and three guns', r.calls + ' draws, ' + Math.round(r.tris / 1000) + 'k triangles, ' + r.mb.toFixed(0) + ' MB');
    ok(!msgs.length, 'soak: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}

// every other map: it loads, most of it can be walked, people standing on it are lit, and a wave's ashen find the player
if (want('maps')) {
    for (const map of ['street', 'depot', 'subway', 'outpost', 'mall', 'carnival', 'lab']) {
        const { ctx, page, msgs } = await open('go=' + map);
        const started = await page.waitForFunction(() => window.__ash.started !== undefined, null, { timeout: 60000 }).then(() => page.evaluate(() => window.__ash.started), () => false);
        ok(started, map + ': loads and starts', started ? '' : await errs(page));
        if (started) {
            const r = await page.evaluate(() => {
                const H = window.__ash, G = H.Game, P = G.P, W = H.World; H.App.locked = true; let hurt = 0, calls = 0, tris = 0; const h0 = G.hurt; G.hurt = () => { hurt++; };
                const L = new Float32Array(4); W.A.probe(P.x, P.z, L);
                for (let i = 0; i < 1500 && G.wave < 2; i++) { P.hp = P.max; H.step(1 / 30, 1); calls = Math.max(calls, H.App.calls); tris = Math.max(tris, H.App.tris); if (hurt > 3) { for (const e of H.Foes.list.slice()) if (e.state !== 'die') H.Foes.damage(e, 9999, false, G, 0); if (G.phase === 'break') G.phaseT = Math.min(G.phaseT, 0.2); } }
                G.hurt = h0; return { reach: W.reach, spots: W.spots.length, light: L[0] + L[1] + L[2], wave: G.wave, hurt, calls, tris, mb: H.R.info.memory.textureBytes / 1048576, errors: H.App.errors.slice(0, 3) };
            });
            ok(r.reach > 2000 && r.spots >= 6 && r.light > (map === 'outpost' || map === 'carnival' || map === 'lab' ? 0.04 : 0.15), map + ': can be walked and is lit', r.reach + ' path cells, ' + r.spots + ' start spots');
            ok(r.hurt > 3 && r.wave >= 2 && !r.errors.length, map + ': the ashen find the player and the wave can be cleared', 'hurt ' + r.hurt + ', wave ' + r.wave + ' ' + r.errors.join(' | '));
            ok(r.calls <= BUDGET.calls && r.tris <= BUDGET.tris && r.mb <= BUDGET.mb, map + ': within the budgets', r.calls + ' draws, ' + Math.round(r.tris / 1000) + 'k triangles, ' + r.mb.toFixed(0) + ' MB');
        }
        ok(!msgs.length, map + ': quiet console', msgs.slice(0, 3).join(' | '));
        await ctx.close();
    }
}

if (want('ui')) {
    const { ctx, page, msgs } = await open('');
    await page.keyboard.press('KeyA'); await sleep(2600);
    const typed = await page.evaluate(() => document.getElementById('intro-text').textContent);
    ok(/^Are you there/.test(typed), 'ui: a first visit types the opening', JSON.stringify(typed.slice(0, 24)));
    await page.keyboard.down('Space'); await sleep(900); await page.keyboard.up('Space'); await sleep(1400);
    const name = await page.evaluate(() => ({ cls: document.getElementById('intro').className, logo: !!document.querySelector('#intro svg.logo'), seen: JSON.parse(localStorage.getItem('ashfall_save')).intro }));
    ok(/name/.test(name.cls) && name.logo && name.seen, 'ui: holding Space skips to the name, and the opening is remembered');
    await sleep(700); await page.keyboard.press('Enter'); await sleep(600);
    const menu = await page.evaluate(() => ({ screen: window.__ash.App.screen, shown: !document.getElementById('menu').classList.contains('hidden'), items: document.querySelectorAll('#menu-nav button').length }));
    ok(menu.screen === 'menu' && menu.shown && menu.items === 5, 'ui: then the main menu');
    const panels = await page.evaluate(async () => {
        const out = {}, H = window.__ash, sleep = ms => new Promise(r => setTimeout(r, ms));
        for (const a of ['ops', 'play', 'armory', 'settings', 'mp']) { document.querySelector('[data-act=' + a + ']').click(); out[a] = document.getElementById('panel-body').textContent.length; if (a === 'settings') { const r = document.querySelector('[data-set=sens]'); r.value = 1.5; r.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-seg=aimToggle][data-v=false]').click(); out.sens = H.Save.data.settings.sens; out.hold = H.Save.data.settings.aimToggle; } document.getElementById('panel-x').click(); }
        for (let i = 0; i < 80 && !H.World.loaded; i++) await sleep(250); out.map = H.World.loaded; H.step(1 / 30, 3); out.calls = H.App.calls;
        return out;
    });
    ok(panels.ops > 100 && panels.play > 100 && panels.armory > 100 && panels.settings > 100 && panels.mp > 50, 'ui: every panel opens');
    ok(panels.sens === 1.5 && panels.hold === false, 'ui: settings are kept');
    ok(panels.map && panels.calls > 3, 'ui: the map turns behind the menu', panels.calls + ' draws');
    // leaving a map gives its memory back, and it can be loaded again (what changing maps does)
    const swap = await page.evaluate(async () => { const H = window.__ash, mb = () => H.R.info.memory.textureBytes / 1048576, a = mb(); H.World.unload(); H.R.render(H.World.scene, H.World.camera); const b = mb(); await H.World.load('yard'); H.step(1 / 30, 3); return { a, b, c: mb(), calls: H.App.calls, errors: H.App.errors.slice(0, 2) }; });
    ok(swap.b < swap.a * 0.35 && swap.c > swap.a * 0.9 && swap.c < swap.a * 1.1 && swap.calls > 3 && !swap.errors.length, 'ui: a map can be left (memory freed) and loaded again', swap.a.toFixed(0) + ' MB -> ' + swap.b.toFixed(0) + ' -> ' + swap.c.toFixed(0) + ' ' + swap.errors.join(' | '));
    ok(!msgs.length, 'ui: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}

// the career: credits, the armory (buying, the kit, attachments, contracts), an operation played to its end, the new kinds
if (want('career')) {
    const { ctx, page, msgs } = await open('menu=1&all=1');
    await page.waitForFunction(() => window.__ash.World.loaded && window.__ash.Foes.loaded, null, { timeout: 90000 }).catch(() => { });
    const a = await page.evaluate(async () => {
        const H = window.__ash, sv = H.Save.data, out = {}, click = s => { const b = document.querySelector(s); if (!b || b.disabled) return false; b.click(); return true; };
        sv.xp = 60000; sv.credits = 5000; H.UI.open('armory');
        out.tiles = document.querySelectorAll('[data-ar^="sel:"]').length; click('[data-ar="sel:smg"]'); out.buy = click('[data-ar="buy:smg"]'); out.owned = !!sv.weapons.smg; out.main = sv.loadout.primary; out.left = sv.credits;
        // mastery opens attachments, and a fitted one changes the gun's numbers
        const m0 = H.Weapons.at('smg', 0).mag; sv.mastery.smg = { kills: 130, att: [], camo: 'factory' }; H.UI.draw(); out.att = click('[data-ar="att:ext"]'); out.mag = [m0, H.Weapons.at('smg', 0).mag]; out.camo = click('[data-ar="camo:rust"]') && sv.mastery.smg.camo;
        click('[data-ar="tab:gear"]'); out.throw = click('[data-ar="gbuy:fire"]') && sv.loadout.throw; out.trait = click('[data-ar="gbuy:plates"]') && sv.perk;
        click('[data-ar="tab:jobs"]'); out.jobs = document.querySelectorAll('.job').length; const c = sv.contracts.list[0]; c.have = 99999; H.UI.draw(); const cr = sv.credits; out.claim = click('[data-ar="claim:0"]') && sv.credits > cr;
        // the gun on the armory page is drawn
        click('[data-ar="tab:guns"]'); for (let i = 0; i < 100 && !H.Gun.models.smg; i++) await new Promise(r => setTimeout(r, 100)); if (H.Gun.models.smg) { sv.mastery.smg.camo = 'bone'; H.Armory.paint(H.Gun.models.smg); } await new Promise(r => setTimeout(r, 500));
        const v = document.getElementById('arm-view'), px = v.getContext('2d').getImageData(0, 0, v.width, v.height).data; let lit = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 60) lit++; out.lit = lit;
        return out;
    });
    ok(a.tiles >= 11 && a.buy && a.owned && a.main === 'smg' && a.left < 5000, 'career: a weapon is bought with credits and goes into the kit', a.tiles + ' weapons, ' + a.left + ' credits left');
    ok(a.att && a.mag[1] > a.mag[0] && a.camo === 'rust', 'career: mastery opens an attachment and a finish', 'magazine ' + a.mag.join(' -> '));
    ok(a.throw === 'fire' && a.trait === 'plates', 'career: a throwable and a trait are bought and taken');
    ok(a.jobs === 7 && a.claim, 'career: three contracts a day, and a finished one pays');
    ok(a.lit > 1500, 'career: the armory shows the weapon itself', a.lit + ' lit pixels');
    // an operation, start to finish (the test does the walking and the killing)
    const o = await page.evaluate(async () => {
        const H = window.__ash, sv = H.Save.data, out = { stages: [] }; H.UI.close(); H.UI.open('ops'); out.list = document.querySelectorAll('[data-op]').length;
        document.querySelector('[data-op=o2]').click(); document.querySelector('[data-go=op]').click();
        for (let i = 0; i < 600 && !(H.App.game && H.Game.op); i++) await new Promise(r => setTimeout(r, 100)); if (!H.Game.op) return out;
        const G = H.Game, P = G.P; H.App.locked = true; out.gun = H.Gun.cur.id; out.armor = P.armor; out.throwKind = G.throwKind;
        // the firebomb burns what stands in it
        for (let i = 0; i < 300 && !H.Foes.list.some(e => e.state !== 'die' && e.born <= 0); i++) { P.hp = P.max; H.step(1 / 30, 1); } const e0 = H.Foes.list.find(e => e.state !== 'die' && e.born <= 0); if (e0) { const hp = e0.hp; H.Armory.burst(G, 'fire', e0.x, e0.z); for (let i = 0; i < 40; i++) { P.hp = P.max; H.step(1 / 30, 1); } out.burn = hp - e0.hp; }
        let guard = 0;
        while (!G.over && guard++ < 4000) {
            const st = G.op.st; P.hp = P.max; if (out.stages[out.stages.length - 1] !== st.k) out.stages.push(st.k);
            if (st.k === 'survive' || st.k === 'boss' || st.k === 'hunt') { for (const e of H.Foes.list.slice()) if (e.state !== 'die' && e.born <= 0) H.Foes.damage(e, 99999, true, G, 0); }
            else if (st.items.length) { const m = st.carry ? st.home : st.items[0]; P.x = m.x; P.z = m.z; }
            H.step(1 / 30, 3);
        }
        out.over = G.over; out.result = G.result && G.result.title; out.stars = G.result && G.result.stars; out.saved = sv.ops.o2; out.marks = H.Marks.list.length;
        for (let i = 0; i < 120; i++) H.step(1 / 30, 1); out.shown = !document.getElementById('results').classList.contains('hidden'); out.next = !!document.querySelector('[data-do=nextop]');
        return out;
    });
    ok(o.list === 18, 'career: eighteen operations are listed', String(o.list));
    ok(o.gun === 'smg' && o.armor >= 50 && o.throwKind === 'fire', 'career: a run starts with the kit', o.gun + ', armour ' + o.armor + ', ' + o.throwKind);
    ok(o.burn > 20, 'career: a firebomb burns what stands in it', Math.round(o.burn || 0) + ' damage');
    ok(o.over && o.result === 'OPERATION COMPLETE' && o.saved >= 1 && o.stages.join() === 'intel,survive,extract', 'career: an operation is played through its stages and saved', (o.stages || []).join(' > ') + ', ' + o.stars + ' stars');
    ok(o.shown && o.next, 'career: the end page offers the next operation');
    // every new kind does its thing
    const k = await page.evaluate(async () => {
        const H = window.__ash, G = H.Game, out = {}; document.querySelector('[data-do=again]').click(); for (let i = 0; i < 100 && G.over; i++) await new Promise(r => setTimeout(r, 50));
        const P = G.P, F = H.Foes, far = () => { let b = H.World.spots[0], bd = 0; for (const s of H.World.spots) { const d = Math.hypot(s[0] - P.x, s[1] - P.z); if (d > bd) { bd = d; b = s; } } return b; };
        const run = n => { for (let i = 0; i < n; i++) { P.hp = P.max; H.step(1 / 30, 1); } }, wipe = () => { F.clear(); G.toSpawn.length = 0; G.phase = 'break'; G.phaseT = 999; };
        H.App.locked = true; wipe(); out.can = ['charger', 'leaper', 'bulwark', 'howler', 'husk', 'bloater', 'foreman', 'widow'].filter(id => F.can(id)).length;
        let s = far(), e = F.spawn('husk', s[0], s[1], 1, 1); e.born = 0; F.damage(e, 9999, false, G, 0); out.mites = F.list.filter(x => x.type === 'mite').length;
        wipe(); e = F.spawn('bloater', s[0], s[1], 1, 1); e.born = 0; F.damage(e, 9999, false, G, 0); out.pool = F.pools.length;
        wipe(); e = F.spawn('bulwark', P.x, P.z + 6, 1, 1); e.born = 0; e.yaw = Math.atan2(P.x - e.x, P.z - e.z); const h0 = e.hp; F.damage(e, 50, false, G, 0); out.front = h0 - e.hp; e.yaw += Math.PI; const h1 = e.hp; F.damage(e, 50, false, G, 0); out.back = h1 - e.hp;
        wipe(); e = F.spawn('widow', s[0], s[1], 1, 1); e.born = 0; e.cool2 = 0; run(20); out.brood = F.list.filter(x => x.type === 'mite').length;
        wipe(); let cs = s; for (let a = 0; a < 6.28; a += 0.4) { const x = P.x + Math.cos(a) * 10, z = P.z + Math.sin(a) * 10; if (!H.World.blocked(x, z, 0.6) && H.World.sees(x, z, P.x, P.z, 1.2)) { cs = [x, z]; break; } } e = F.spawn('charger', cs[0], cs[1], 1, 1); e.born = 0; e.cool = 0; let seen = {}; for (let i = 0; i < 400; i++) { run(1); seen[e.state] = 1; } out.states = Object.keys(seen).join();
        return out;
    });
    ok(k.can === 8, 'career: the new kinds and bosses have a figure', k.can + ' of 8');
    ok(k.mites === 3 && k.pool === 1 && k.brood >= 3, 'career: a husk splits, a bloater leaves a puddle, the Widow broods', k.mites + ' mites, ' + k.pool + ' puddle, ' + k.brood + ' brood');
    ok(k.front < 15 && k.back > 45, 'career: a bulwark only stops what hits its front', 'front ' + k.front + ', back ' + k.back);
    ok(/windup/.test(k.states) && /charge/.test(k.states), 'career: a charger walks, winds up and charges when it sees you', k.states);
    // the later classes, the other things G can be, power-ups, the run that is kept, the sandbox
    const x = await page.evaluate(async () => {
        const H = window.__ash, G = H.Game, sv = H.Save.data, out = {}, wait = async f => { for (let i = 0; i < 600 && !f(); i++) await new Promise(r => setTimeout(r, 50)); };
        H.Game.stop(); H.UI.menu(); out.classes = Object.keys(H.CLASSES).length; sv.own.c4 = 1; sv.loadout.throw = 'c4'; sv.perk = 'none';
        await H.UI.play({ map: 'yard', diff: 'easy', cls: 'engineer', rule: 'classic' }); let P = G.P; H.App.locked = true; const run = n => { for (let i = 0; i < n; i++) { G.P.hp = G.P.max; H.step(1 / 30, 1); } };
        for (let i = 0; i < 400 && !H.Foes.list.some(e => e.state !== 'die' && e.born <= 0); i++) run(1);
        // the sentry gun (the engineer's ability): it stands, and it hurts what it can see
        const e0 = H.Foes.list.find(e => e.state !== 'die' && e.born <= 0); if (e0) { P.x = e0.x; P.z = e0.z + 5; P.yaw = Math.PI; } run(2); H.hit.KeyX = true; run(1); out.turret = G.turrets.length; const hp0 = e0 ? e0.hp : 0; run(90); out.sentry = e0 ? hp0 - Math.max(0, e0.hp) : 0;
        // a satchel: G sets it, G again fires it
        const n0 = G.nades; H.hit.KeyG = true; run(1); out.set = G.thrown.filter(g => g.kind === 'c4').length; run(40); out.waits = G.thrown.filter(g => g.kind === 'c4').length; H.hit.KeyG = true; run(1); out.gone = G.thrown.filter(g => g.kind === 'c4').length === 0 && G.nades === n0 - 1;
        // clear the wave: the run is kept; leave; CONTINUE picks it up
        let guard = 0; while (G.phase === 'fight' && guard++ < 600) { for (const e of H.Foes.list.slice()) if (e.state !== 'die') H.Foes.damage(e, 99999, true, G, 0); run(3); }
        out.kept = !!sv.run && sv.run.wave === G.wave; const wave = G.wave; G.cash = 4321; H.Extras.keep(G); H.Game.stop(); H.UI.menu(); H.UI.open('play'); const b = document.querySelector('[data-go=resume]'); out.offer = !!b; if (b) { b.click(); await wait(() => H.App.game && G.wave === wave); }
        out.back = G.wave === wave && G.cash === 4321 && G.cls === 'engineer'; P = G.P; H.App.locked = true;
        // going down ends it: the kept run is gone, the class is paid
        G.P.hp = 1; G.wind = false; G.hurt(0, 9999, 0, 0, null); out.over = G.over; out.dropped = !sv.run; out.clsXp = sv.cls.engineer ? sv.cls.engineer.xp : 0;
        H.Game.stop(); H.UI.menu(); H.UI.open('armory'); document.querySelector('[data-ar="tab:jobs"]').click(); out.jobs = document.querySelectorAll('.job').length; H.UI.close();
        // the scout's dash, the marksman's mark, in a sandbox
        await H.UI.play({ map: 'yard', diff: 'easy', cls: 'scout', rule: 'sandbox' }); H.App.locked = true; out.sand = G.cash; const x0 = G.P.x, z0 = G.P.z; H.hit.KeyX = true; H.step(1 / 30, 12); out.dash = Math.hypot(G.P.x - x0, G.P.z - z0);
        G.cls = 'marksman'; G.abilT = 0; G.abilOn = 0; for (let i = 0; i < 400 && !H.Foes.list.some(e => e.state !== 'die' && e.born <= 0); i++) { G.P.hp = G.P.max; H.step(1 / 30, 1); } const m = H.Foes.list.find(e => e.state !== 'die' && e.born <= 0); if (m) { G.P.x = m.x; G.P.z = m.z + 4; H.step(1 / 30, 1); H.hit.KeyX = true; H.step(1 / 30, 1); out.marked = H.Foes.list.filter(e => e.marked > 0).length; }
        G.P.hp = 1; G.hurt(0, 9999, 0, 0, null); out.sandXp = G.result ? G.result.xp : -1; out.errors = H.App.errors.slice(0, 3);
        return out;
    });
    ok(x.classes === 8 && x.turret === 1 && x.sentry > 30, 'career: eight classes; the engineer sets a sentry gun that fights', 'sentry did ' + Math.round(x.sentry || 0));
    ok(x.set === 1 && x.waits === 1 && x.gone, 'career: a satchel waits until G is pressed again');
    ok(x.kept && x.offer && x.back, 'career: a cleared wave keeps the run, and CONTINUE picks it up with its cash');
    ok(x.over && x.dropped && x.clsXp > 0 && x.jobs === 7, 'career: going down ends the kept run and pays the class; weekly contracts and prestige are listed', 'class xp ' + x.clsXp + ', ' + x.jobs + ' rows');
    ok(x.sand === 99999 && x.dash > 3 && x.marked === 1 && x.sandXp === 0 && !x.errors.length, 'career: the sandbox gives cash and records nothing; the scout dashes, the marksman marks', 'dash ' + (x.dash || 0).toFixed(1) + ' m ' + (x.errors || []).join(' | '));
    ok(!msgs.length, 'career: quiet console', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}
if (want('modes')) {
    const { ctx, page, msgs } = await open('menu=1');
    await page.waitForFunction(() => window.__ash.World.loaded && window.__ash.Foes.loaded, null, { timeout: 90000 }).catch(() => { });
    const r = await page.evaluate(async () => {
        const H = window.__ash, N = H.Net, G = H.Game, out = {}, wait = async f => { for (let i = 0; i < 800 && !f(); i++) await new Promise(r => setTimeout(r, 50)); };
        const start = async mode => { if (H.App.game) { G.net = null; G.stop(); H.UI.menu(); } N.reset(); N.on = true; N.host = true; N.state = 'lobby'; N.me = { id: 'H', name: 'Hosty' }; N.roster = [N.entry('H', 'Hosty')]; N.cfg = { mode, map: 'yard', diff: 'normal', goal: 10, bots: 3 }; N.startMatch(); await wait(() => H.App.game && G.net && G.mode === 'dm' && !G.over && G.time < 1); H.App.locked = true; };
        const run = n => { for (let i = 0; i < n; i++) { if (!G.P.dead) G.P.hp = G.P.max; H.step(1 / 30, 1); } }, bots = () => G.players.filter(p => p.bot), row = id => N.roster.find(x => x.id === id);
        out.modes = Object.keys(H.MP_MODES).length;
        // gun game: a kill gives the next gun; the last gun's kill wins
        await start('gg'); await wait(() => H.Gun.cur && H.Gun.cur.id === N.cfg.gg[0]); out.gg0 = H.Gun.cur.id; out.ggN = N.cfg.gg.length; N.scoreKill('H', bots()[0].id, false, ''); run(3); await wait(() => H.Gun.cur && H.Gun.cur.id === N.cfg.gg[1]); out.gg1 = H.Gun.cur.id === N.cfg.gg[1];
        row('H').kills = N.cfg.gg.length - 1; N.scoreKill('H', bots()[0].id, false, ''); out.ggWin = G.over && G.result.big === 'VICTORY';
        // king of the hill: alone in the ring, your side scores; the ring is marked
        await start('koth'); run(5); const h = H.Modes.hill(G); for (const b of bots()) { b.x = b.tx = H.World.home[0]; b.z = b.tz = H.World.home[1]; b.dead = true; b.respawn = 99; } for (let i = 0; i < 100; i++) { G.P.x = h[0]; G.P.z = h[1]; run(1); } out.koth = G.pts[G.P.team]; out.kothMark = H.Marks.list.length; out.kothLine = document.getElementById('hud-top').textContent;
        // kill confirmed: a kill leaves a tag; walking over it scores
        await start('kc'); run(5); const foe = bots().find(b => b.team !== G.P.team); foe.x = foe.tx = G.P.x + 6; foe.z = foe.tz = G.P.z; N.pvpHit('H', foe.id, 999, false, 'carbine'); run(2); out.tags = G.tags.length; out.kcDraw = G.pickups.length; const tg = G.tags[0]; if (tg) { for (const b of bots()) { b.dead = true; b.respawn = 99; } for (let i = 0; i < 10; i++) { G.P.x = tg.x; G.P.z = tg.z; run(1); } } out.kc = G.pts[G.P.team];
        // capture the flag: take theirs, bring it home, score
        await start('ctf'); run(5); for (const b of bots()) { b.dead = true; b.respawn = 999; } const T = G.P.team === 1 ? 1 : 0, F = G.flags[1 - T]; for (let i = 0; i < 6; i++) { G.P.x = F.home[0]; G.P.z = F.home[1]; run(1); } out.took = F.st === 1 && F.by === 'H'; const O = G.flags[T]; for (let i = 0; i < 6; i++) { G.P.x = O.home[0]; G.P.z = O.home[1]; run(1); } out.ctf = G.pts[T]; out.home = F.st === 0;
        // infection: someone turns; a kill by the infected turns the one killed; no survivors ends it
        await start('inf'); for (let i = 0; i < 200 && !G.infOn; i++) run(1); out.infected = N.roster.filter(x => x.team === 1).length; const z = N.roster.find(x => x.team === 1), s = N.roster.filter(x => x.team === 0); for (const v of s) N.scoreKill(z.id, v.id, false, 'knife'); out.infOver = G.over; out.infTitle = G.result && G.result.title;
        // hunted: the first kill makes the hunted, who then scores
        await start('hunt'); run(5); N.scoreKill('H', bots()[0].id, false, ''); out.hunted = G.hunted; out.hp = G.P.max; N.scoreKill('H', bots()[1].id, false, ''); out.pts = row('H').pts; N.scoreKill(bots()[2].id, 'H', false, ''); out.hunted2 = G.hunted;
        // a long careless go at each with the bots playing: nothing throws
        for (const m of ['koth', 'kc', 'ctf', 'inf', 'tdm']) { await start(m); run(500); }
        out.errors = H.App.errors.slice(0, 3); G.net = null; G.stop(); N.reset();
        return out;
    });
    ok(r.modes === 9 && r.gg0 && r.gg1 && r.ggWin, 'modes: nine kinds of match; gun game hands out the next gun and the last kill wins', r.ggN + ' guns from ' + r.gg0);
    ok(r.koth >= 2 && r.kothMark >= 1 && /FIRST TO 90/.test(r.kothLine), 'modes: king of the hill scores for the side alone in the ring', r.koth + ' points');
    ok(r.tags === 1 && r.kcDraw === 1 && r.kc === 1, 'modes: kill confirmed: a kill leaves a tag and picking it up scores');
    ok(r.took && r.ctf === 1 && r.home, 'modes: capture the flag: their flag carried home scores and goes back');
    ok(r.infected === 1 && r.infOver && /INFECTED/.test(r.infTitle), 'modes: infection: one turns, the killed turn, no survivors ends it', r.infTitle);
    ok(r.hunted === 'H' && r.hp === 300 && r.pts === 1 && r.hunted2 && r.hunted2 !== 'H', 'modes: hunted: the first kill makes the hunted, who scores until someone kills them');
    ok(!r.errors.length && !msgs.length, 'modes: bots play every kind without an error', r.errors.concat(msgs).slice(0, 3).join(' | '));
    await ctx.close();
}
if (want('mp')) {
    const A = await open('menu=1'), B = await open('menu=1');
    const ev = (p, f, a) => p.page.evaluate(f, a), until = (p, f, ms) => p.page.waitForFunction(f, null, { timeout: ms || 30000 }).then(() => true, () => false);
    await until(A, () => window.__ash.World.loaded, 60000); await until(B, () => window.__ash.World.loaded, 60000);
    await ev(A, () => { const H = window.__ash; H.Save.data.name = 'Hosty'; H.Net.hostGame(); });
    const hosted = await until(A, () => window.__ash.Net.state === 'lobby' && window.__ash.Net.code.length === 6, 30000), code = await ev(A, () => window.__ash.Net.code);
    ok(hosted, 'mp: a party opens with a 6-digit code', hosted ? code : await ev(A, () => window.__ash.Net.err || window.__ash.Net.state));
    if (hosted) {
        await ev(B, c => { const H = window.__ash; H.Save.data.name = 'Guesty'; H.Net.join(c); }, code);
        const joined = await until(A, () => window.__ash.Net.roster.length === 2, 40000) && await until(B, () => window.__ash.Net.state === 'lobby' && window.__ash.Net.me.id === 'p1', 10000);
        ok(joined, 'mp: a second player joins with the code', joined ? await ev(B, () => window.__ash.Net.roster.map(r => r.name).join(' + ')) : await ev(B, () => window.__ash.Net.err || window.__ash.Net.state));
        if (joined) {
            // ---- squad holdout
            await ev(A, () => { const H = window.__ash; H.Net.cfg.mode = 'coop'; H.Net.lobby(); H.Net.startMatch(); });
            const both = await until(A, () => window.__ash.App.game && window.__ash.Game.net, 60000) && await until(B, () => window.__ash.App.game && window.__ash.Game.net, 60000);
            ok(both, 'mp: the host starts and both are in the match');
            if (both) {
                const run = (p, n) => ev(p, n => { const H = window.__ash; H.App.locked = true; H.App.paused = false; for (let i = 0; i < n; i++) { H.Game.P.hp = H.Game.P.max; H.step(1 / 30, 1); } }, n);
                for (let i = 0; i < 26; i++) { await run(A, 12); await run(B, 12); await sleep(60); }
                const a = await ev(A, () => { const H = window.__ash, G = H.Game; return { wave: G.wave, foes: H.Foes.list.length, n: G.players.length, ox: G.players[1].x, oz: G.players[1].z, me: [G.P.x, G.P.z] }; });
                const b = await ev(B, () => { const H = window.__ash, G = H.Game; return { wave: G.wave, foes: H.Foes.list.length, n: G.players.length, ox: G.players[1].x, oz: G.players[1].z, me: [G.P.x, G.P.z], host: G.net.host, tags: Object.keys(H.Net.tags).length }; });
                ok(a.n === 2 && b.n === 2 && Math.hypot(a.ox - b.me[0], a.oz - b.me[1]) < 1.5 && Math.hypot(b.ox - a.me[0], b.oz - a.me[1]) < 1.5, 'mp: each sees where the other stands', 'off by ' + Math.hypot(a.ox - b.me[0], a.oz - b.me[1]).toFixed(2) + ' m');
                ok(a.wave >= 1 && b.wave === a.wave && a.foes > 0 && b.foes > 0 && !b.host, 'mp: the guest sees the host\'s wave and ashen', 'wave ' + b.wave + ', ' + a.foes + ' on the host, ' + b.foes + ' on the guest');
                // the guest shoots one: the host takes the health off and tells everyone when it dies
                const tgt = await ev(B, () => { const H = window.__ash, e = H.Foes.list.find(x => x.state !== 'die'); if (!e) return 0; H.Game.hitFoe(e, 9999, true, 0); return e.id; });
                for (let i = 0; i < 8; i++) { await run(B, 4); await run(A, 4); await sleep(60); }
                const killed = await ev(A, id => { const e = window.__ash.Foes.list.find(x => x.id === id); return !e || e.state === 'die'; }, tgt), paid = await ev(B, () => ({ kills: window.__ash.Game.kills, cash: window.__ash.Game.cash }));
                ok(tgt && killed && paid.kills === 1 && paid.cash > 0, 'mp: a guest\'s kill lands on the host and pays the guest', '$' + paid.cash);
                // an ashen hurts the guest through the host
                await ev(A, () => { const H = window.__ash; H.Game.hurt(1, 30, 0, 0, null); });
                await sleep(300); const hp = await ev(B, () => { const H = window.__ash, P = H.Game.P; const v = P.hp; return v; });
                ok(hp < 100, 'mp: the host\'s ashen hurt the guest', 'health ' + Math.round(hp));
                // ---- back to the party, then a deathmatch with bots
                await ev(A, () => { const H = window.__ash; H.Game.net = null; H.Game.stop(); H.UI.menu(); H.Net.state = 'lobby'; H.Net.cfg.mode = 'dm'; H.Net.cfg.bots = 2; H.Net.cfg.goal = 10; H.Net.lobby(); });
                await ev(B, () => { const H = window.__ash; H.Game.net = null; H.Game.stop(); H.UI.menu(); H.Net.state = 'lobby'; });
                await sleep(400); await ev(A, () => window.__ash.Net.startMatch());
                const dm = await until(A, () => window.__ash.App.game && window.__ash.Game.mode === 'dm', 60000) && await until(B, () => window.__ash.App.game && window.__ash.Game.mode === 'dm', 60000);
                ok(dm, 'mp: a deathmatch starts for both');
                if (dm) {
                    const st0 = await ev(A, () => window.__ash.Game.players.filter(p => p.bot).map(p => [p.x, p.z]));
                    for (let i = 0; i < 40; i++) { await run(A, 15); await run(B, 15); await sleep(40); }
                    const d = await ev(A, () => { const H = window.__ash, G = H.Game; return { n: G.players.length, bots: G.players.filter(p => p.bot).map(p => [p.x, p.z]), score: H.Net.roster.reduce((s, r) => s + r.kills + r.deaths, 0), t: G.matchT }; });
                    const moved = d.bots.reduce((s, b, i) => s + Math.hypot(b[0] - st0[i][0], b[1] - st0[i][1]), 0);
                    ok(d.n === 4 && moved > 3, 'mp: bots fill in and move', d.n + ' players, bots moved ' + moved.toFixed(0) + ' m');
                    // the guest hits the host: the host's health goes down; then finishes them: the score counts it for the guest
                    await ev(A, () => { const P = window.__ash.Game.P; P.safe = 0; P.hp = 100; P.dead = false; });
                    await ev(B, () => { const H = window.__ash, G = H.Game; H.Net.hitPlayer(G.players.find(p => p.id === 'H'), 40, false, 'carbine'); });
                    await sleep(500); const hh = await ev(A, () => window.__ash.Game.P.hp);          // (run() would top the health up again)
                    ok(hh < 100, 'mp: one player\'s shot hurts another', 'host health ' + Math.round(hh));
                    await ev(A, () => { window.__ash.Game.P.safe = 0; }); await ev(B, () => { const H = window.__ash, G = H.Game; H.Net.hitPlayer(G.players.find(p => p.id === 'H'), 500, true, 'carbine'); });
                    await sleep(500); await run(A, 2); await sleep(400); await run(B, 2);
                    const sc = await ev(B, () => { const H = window.__ash, me = H.Net.roster.find(r => r.id === H.Net.me.id); return { kills: me.kills, mine: H.Game.kills, board: document.getElementById('scores').textContent.length }; });
                    ok(sc.kills >= 1 && sc.mine >= 1 && sc.board > 20, 'mp: the kill is on the scoreboard', sc.kills + ' kill(s)');
                    const back = await ev(A, () => { const H = window.__ash; for (let i = 0; i < 120; i++) H.step(1 / 30, 1); return { dead: H.Game.P.dead, hp: H.Game.P.hp }; });
                    ok(!back.dead && back.hp === 100, 'mp: the one killed comes back');
                }
            }
        }
    }
    ok(!A.msgs.length && !B.msgs.length, 'mp: quiet consoles', A.msgs.concat(B.msgs).slice(0, 3).join(' | '));
    await A.ctx.close(); await B.ctx.close();
}

// the code in the owner's Google Doc (Proof Slice/loader.html) pasted into a page somewhere else: the newest test build is
// found on the CDN, and from build 3 its page hands over to Ashfall, which loads its models from the CDN too.
// The CDN is played by this checkout (builds proof1..proof3 exist); --live uses the real one.
if (parts.includes('loader') || (!parts.length && !args.includes('--live'))) {
    const fs = await import('node:fs'), path = await import('node:path'), { fileURLToPath } = await import('node:url'), ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), live = args.includes('--live');
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), msgs = [];
    page.on('pageerror', e => msgs.push('error: ' + e.message.slice(0, 200))); page.on('console', m => { if (/\[HG3D\]/.test(m.text()) || (m.type() === 'error' && !/Failed to load resource/.test(m.text()))) msgs.push(m.text().slice(0, 240)); });
    await page.route('https://fiddle.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, 'Proof Slice/loader.html')) }));
    if (!live) await page.route(/^https:\/\/\w+\.jsdelivr\.net\/gh\//, r => {
        const u = new URL(r.request().url()), m = /^\/gh\/hunterefstration\/huntington-games@proof(\d+)\/(.*)$/.exec(decodeURIComponent(u.pathname)), H = { 'access-control-allow-origin': '*' };
        if (!m || +m[1] > 3) return r.fulfill({ status: 404, body: 'no such tag', headers: H });
        const file = path.join(ROOT, m[2]); if (!fs.existsSync(file)) return r.fulfill({ status: 404, body: 'not found', headers: H });
        r.fulfill({ status: 200, body: fs.readFileSync(file), headers: Object.assign(H, { 'content-type': /\.html$/.test(file) ? 'text/html' : /\.json$/.test(file) ? 'application/json' : /\.webp$/.test(file) ? 'image/webp' : 'application/octet-stream' }) });
    });
    await page.goto('https://fiddle.test/show', { waitUntil: 'load', timeout: 90000 });
    const up = await page.waitForFunction(() => !!window.__ash, null, { timeout: 30000 }).then(() => true, () => false);
    ok(up, 'loader: the pasted test code ends up in Ashfall');
    if (up) {
        const v = await page.evaluate(() => ({ build: window.HG_PROOF, base: window.HG_BASE, at: location.host, screen: window.__ash.App.screen, slice: !!window.__proof }));
        ok(v.build >= 3 && /Ashfall\/$/.test(v.base) && v.at === 'fiddle.test' && !v.slice, 'loader: Ashfall knows where its files are', 'build ' + v.build + ', ' + v.base.slice(-40));
        const run = await page.evaluate(async () => { const H = window.__ash; const good = await H.UI.play({ map: 'yard', diff: 'normal', cls: 'assault' }); H.App.locked = true; H.step(1 / 30, 30); return { good, calls: H.App.calls, gun: H.Gun.cur && H.Gun.cur.id, made: H.Weapons.list().length, errors: H.App.errors.slice(0, 3) }; });
        ok(run.good && run.calls > 5 && run.gun === 'carbine' && !run.errors.length, 'loader: a run starts with everything loaded from the CDN', run.calls + ' draws, ' + run.made + ' weapons made ' + run.errors.join(' | '));
        // from the menu, over to Steel Storm Remastered in the same page (there is no address to go to inside a loader page)
        await page.evaluate(() => { const H = window.__ash; H.Game.stop(); H.UI.menu(); document.querySelector('[data-do=ssr]').click(); });
        const over = await page.waitForFunction(() => !!window.__ssr, null, { timeout: 30000 }).then(() => true, () => false);
        const ss = over ? await page.evaluate(async () => { const H = window.__ssr; const good = await H.UI.play(); H.App.locked = true; H.step(1 / 30, 20); return { good, base: window.HG_BASE, calls: H.App.calls, units: H.Units.list.length, errors: H.App.errors.slice(0, 3) }; }) : { errors: [] };
        ok(over && ss.good && /Steel%20Storm%20Remastered\/$/.test(ss.base) && ss.calls > 5 && ss.units >= 1 && !ss.errors.length, 'loader: the menu can go over to Steel Storm Remastered and a skirmish starts', over ? ss.calls + ' draws ' + ss.errors.join(' | ') : 'it never arrived');
    }
    ok(!msgs.length, 'loader: no script error', msgs.slice(0, 3).join(' | '));
    await ctx.close();
}

await browser.close(); server.close();
console.log(fails ? fails + ' FAILED' : 'ashfall: all passed');
process.exit(fails ? 1 : 0);
