// Steel Storm Rebuilt: the old game on new models and new battlefields. What is checked here is what the rebuild adds:
// every battlefield keeps the rules spawning and the computer's crews count on, a battle with crews runs on each, the new
// models hang on the old pivots, an old save still loads. The old game's own behaviour is its own suites' business.
//   NODE_PATH="$(npm root -g)" node tools/tests/ssx.mjs [grounds battle models save]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const want = process.argv.slice(2).filter(a => !a.startsWith('--')), on = k => !want.length || want.includes(k);
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); } };
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const OLD_SAVE = { v: 2, seenHow: true, seenNew: '2.3', credits: 4321, stats: { matches: 3, wins: 2, kills: 9, deaths: 4 }, opts: { len: 5, map: 'small', ff: 0, wx: 'evening', pub: 1 } };
async function open(query, save) {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 600 } })).newPage(); page.errs = [];
    await page.addInitScript(s => { Element.prototype.requestPointerLock = function () { }; try { if (!localStorage.getItem('steelstorm_save')) localStorage.setItem('steelstorm_save', JSON.stringify(s)); } catch (e) { } }, save || OLD_SAVE);
    page.on('pageerror', e => page.errs.push(e.message.slice(0, 200)));
    await page.goto(base + '/Steel%20Storm%20Rebuilt/index.html?' + (query || ''), { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__steelstorm && window.__steelstorm.state !== undefined, null, { timeout: 60000 });
    await page.waitForTimeout(400); return page;
}

if (on('save')) {
    // an unreleased game carries no licence block (tools/build-release.py issues one at release): a copied one shuts the game outside localhost
    ok(!/<!--HG-->/.test(fs.readFileSync('Steel Storm Rebuilt/index.html', 'utf8')), 'save: the built page carries no licence block copied from the live game');
    const p = await open('');
    const s = await p.evaluate(() => { const S = window.__steelstorm; return { credits: S.save.credits, ground: S.save.opts.ground, map: S.save.opts.map, wx: S.save.opts.wx, len: S.save.opts.len, cur: S.ground }; });
    ok(s.credits === 4321 && s.map === 'small' && s.wx === 'evening' && s.len === 5, 'save: a save from the old game loads with its credits and options', JSON.stringify(s));
    ok(s.ground === 'ridge' && s.cur === 'ridge', 'save: it gains the battlefield option, and the first battlefield stands behind the menu', s.ground + ' / ' + s.cur);
    ok(!p.errs.length, 'save: no script error', p.errs.join(' | ')); await p.context().close();
}

if (on('grounds')) {
    const p = await open('');
    const R = await p.evaluate(() => {
        const S = window.__steelstorm, out = {}, H = S.H;
        const kids0 = S.scene.children.length;
        for (const id of Object.keys(S.GROUNDS)) {
            S.useGround(id); const o = out[id] = { cur: S.ground, objs: S.world.length, houses: S.BLD.length };
            // spawns: tanks on dry land of the main landmass at a height they can start from, ships in deep water
            let g = 0, n = 0; for (let i = 0; i < 60; i++) for (const t of [0, 1]) { const a = S.T.pickSpawn(t, 'g', false), b = S.T.pickSpawn(t, 'n', false); if (a && H(a.x, a.z) > 3 && H(a.x, a.z) < 22 && S.compOf(a.x, a.z) === 0 && (t ? a.x > 300 : a.x < -300)) g++; if (b && H(b.x, b.z) < -6) n++; }
            o.tankSpawns = g; o.shipSpawns = n;
            o.points = S.PTS.every(q => H(q.x, q.z) > 2 && S.compOf(q.x, q.z) === 0) && S.GROUNDS[id].flags.every(q => H(q.x, q.z) > 2 && S.compOf(q.x, q.z) === 0);
            // the middle box the crews roam is land; the lanes the ships cruise are deep
            let land = 0, tot = 0; for (let x = -210; x <= 210; x += 10) for (let z = -120; z <= 120; z += 10) { tot++; if (H(x, z) > 1) land++; } o.middle = land / tot;
            let deep = 0, dt = 0; for (let x = -300; x <= 300; x += 20) for (const z of [-560, -520, -480, 480, 520, 560]) { dt++; if (H(x, z) < -3.5) deep++; } o.lanes = deep / dt;
            // a tank can drive from one base to every point and to the other base without wetting its tracks
            const N = 144, C = 10, cell = (x, z) => Math.floor((x + 720) / C) + N * Math.floor((z + 720) / C), seen = new Uint8Array(N * N), F = S.GROUNDS[id].flags, q = [cell(F[0].x, F[0].z)]; seen[q[0]] = 1;
            while (q.length) { const c = q.pop(), cx = c % N, cz = (c - cx) / N; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue; const k = x + N * z; if (seen[k]) continue; if (H(x * C - 715, z * C - 715) < 0.8) continue; seen[k] = 1; q.push(k); } }
            o.reach = S.PTS.every(pt => seen[cell(pt.x, pt.z)]) && !!seen[cell(F[1].x, F[1].z)];
            // steepest ground between the bases along the main road (a tank must manage it)
            let steep = 0; const rd = S.GROUNDS[id].roads[0]; for (let i = 1; i < rd.length; i++) for (let k = 0; k < 20; k++) { const x = rd[i - 1][0] + (rd[i][0] - rd[i - 1][0]) * k / 20, z = rd[i - 1][1] + (rd[i][1] - rd[i - 1][1]) * k / 20; if (H(x, z) > 1) steep = Math.max(steep, Math.abs(H(x + 3, z) - H(x - 3, z)) / 6, Math.abs(H(x, z + 3) - H(x, z - 3)) / 6); } o.steep = +steep.toFixed(2);
            o.top = 0; for (let x = -700; x <= 700; x += 20) for (let z = -700; z <= 700; z += 20) o.top = Math.max(o.top, H(x, z)); o.top = Math.round(o.top);
        }
        // going round the battlefields again leaves nothing behind
        const ids = Object.keys(S.GROUNDS); S.useGround(ids[0]); const a = S.scene.children.length, w = S.world.length; for (const id of ids) S.useGround(id); S.useGround(ids[0]);
        out._leak = { before: a, after: S.scene.children.length, world: w, worldAfter: S.world.length, kids0 };
        return out;
    });
    for (const id of Object.keys(R)) { if (id[0] === '_') continue; const o = R[id], tag = 'grounds: ' + id + ': ';
        ok(o.cur === id && o.objs > 10 && o.houses >= 30, tag + 'it is built, with its houses', o.objs + ' things, ' + o.houses + ' houses');
        ok(o.tankSpawns === 120 && o.shipSpawns === 120, tag + 'tanks start on dry land at their base and ships in deep water, every time', o.tankSpawns + ' / ' + o.shipSpawns + ' of 120');
        ok(o.points && o.reach, tag + 'the points and bases are on the main land and a tank can drive between them', 'on land ' + o.points + ', reachable ' + o.reach);
        ok(o.middle > 0.97 && o.lanes > 0.9, tag + 'the middle is land and the ship lanes are deep', 'middle ' + (o.middle * 100).toFixed(1) + ' %, lanes ' + (o.lanes * 100).toFixed(1) + ' %');
        ok(o.steep < 0.45, tag + 'the main road is not too steep for a tank', 'steepest ' + o.steep + ', highest ground ' + o.top + ' m');
    }
    ok(R._leak.before === R._leak.after && R._leak.world === R._leak.worldAfter, 'grounds: changing battlefield leaves nothing of the last one behind', JSON.stringify(R._leak));
    ok(!p.errs.length, 'grounds: no script error', p.errs.join(' | ')); await p.context().close();
}

if (on('battle')) {
    const p = await open('');
    const ids = await p.evaluate(() => Object.keys(window.__steelstorm.GROUNDS));
    for (const id of ids) {
        const r = await p.evaluate(async id => {
            const S = window.__steelstorm; S.noRender(true);
            S.startMatch({ ground: id, mode: 'conq', size: 5, bots: 'mixed', diff: 'normal', wx: 'noon', veh: 'g1b' });
            const at0 = {}; for (const e of S.ents()) at0[e.id] = [e.x, e.z];
            for (let k = 0; k < 45; k++) { S.step(30, 1 / 30); await new Promise(r => setTimeout(r, 0)); }
            const es = S.ents(), bots = es.filter(e => e.bot), lines = {}; let moved = 0, wet = 0, shots = 0;
            for (const e of bots) { const full = S.ent(e.id), ln = full.def.ln; lines[ln] = (lines[ln] || 0) + 1; if (ln === 'g') { if (e.alive && S.H(e.x, e.z) < -1) wet++; } if (Math.hypot(e.x - at0[e.id][0], e.z - at0[e.id][1]) > 30 || !e.alive || e.deaths) moved++; }
            const hurt = es.filter(e => e.deaths > 0 || e.kills > 0).length, pts = S.points ? S.points.filter(q => q.own >= 0 || q.prog > 0).length : 0;
            const o = { ground: S.ground, state: S.state, n: es.length, bots: bots.length, moved, wet, hurt, pts, lines, t: Math.round(S.match.t) };
            S.leave(); S.noRender(false); return o;
        }, id);
        const tag = 'battle: ' + id + ': ';
        ok(r.ground === id && r.n === 10 && r.t >= 40, tag + 'a 5 v 5 battle runs on it', JSON.stringify(r));
        ok(r.moved >= r.bots * 0.8 && r.wet === 0, tag + 'the crews move out and no tank drives into the sea', 'moved ' + r.moved + ' of ' + r.bots + ', in water ' + r.wet);
        ok(r.hurt > 0 || r.pts > 0, tag + 'they fight or take points within 45 seconds', 'with kills or deaths ' + r.hurt + ', points touched ' + r.pts);
    }
    ok(!p.errs.length, 'battle: no script error', p.errs.join(' | ')); await p.context().close();
}

if (on('models')) {
    const have = fs.readdirSync('Steel Storm Rebuilt/assets').filter(f => /^v_.*\.hgm$/.test(f)).map(f => f.slice(2, -4));
    const p = await open('');
    const R = await p.evaluate(async have => {
        const S = window.__steelstorm, out = [];
        for (const id of have) {
            const def = S.vdef(id, 31), P = S.getParts(def, 0), m = S.makeModel(def, 0, 42); for (let i = 0; i < 100 && !S.NEWM[id].ready && !S.NEWM[id].none; i++) await new Promise(r => setTimeout(r, 50));
            const N = S.NEWM[id], o = { id, ready: !!N.ready, none: N.none || '', isNew: !!m.isNew, tris: Math.round(N.tris || 0) };
            let oldShown = 0, newShown = 0; m.root.traverse(c => { if (c.isMesh) { if (m.old.includes(c)) { if (c.visible) oldShown++; } else if (c.visible) newShown++; } }); o.oldShown = oldShown; o.newShown = newShown;
            if (def.ln === 'g' || (def.base || def).ln === 'g') { o.tur = m.tur.position.toArray().map((v, i) => Math.abs(v - P.tpos[i]) < 1e-6).every(Boolean); o.gun = m.gun.position.toArray().map((v, i) => Math.abs(v - P.gpos[i]) < 1e-6).every(Boolean); o.muz = Math.abs(m.muzzles[0].position.z - P.muz[0][2]) < 1e-6; }
            const m1 = S.makeModel(def, 1, 7); o.sides = m1.isNew && S.NEWM[id].mats[0] && S.NEWM[id].mats[1] && S.NEWM[id].mats[0].skin.color.getHex() !== S.NEWM[id].mats[1].skin.color.getHex();
            out.push(o);
        }
        // a vehicle with no file keeps the box model
        const none = S.VEHS.find(v => !have.includes(v.id)); let keep = null; if (none) { const m = S.makeModel(S.vdef(none.id, 0), 0, 1); await new Promise(r => setTimeout(r, 700)); keep = { id: none.id, isNew: !!m.isNew, shown: m.old.filter(c => c.visible).length }; }
        return { out, keep };
    }, have);
    ok(have.length > 0, 'models: there are new models to check', have.length + ' files');
    for (const o of R.out) {
        ok(o.ready && o.isNew && o.newShown >= (o.tur !== undefined ? 3 : 2) && o.oldShown === 0, 'models: ' + o.id + ' loads and takes the box model\'s place', JSON.stringify(o));
        if (o.tur !== undefined) ok(o.tur && o.gun && o.muz, 'models: ' + o.id + ' turret, gun and muzzle are where the old ones were', JSON.stringify(o));
        ok(o.sides, 'models: ' + o.id + ' the two sides are painted differently');
    }
    if (R.keep) ok(!R.keep.isNew && R.keep.shown > 0, 'models: a vehicle with no new model yet keeps its box model', JSON.stringify(R.keep));
    // the scenery kit: when its file is there the world is built with it, on every battlefield, and the houses still stand on the old boxes
    if (fs.existsSync('Steel Storm Rebuilt/assets/s_kit.hgm')) {
        const k = await p.evaluate(async () => { const S = window.__steelstorm; await S.loadKit(); const o = { ready: S.KIT.ready, none: S.KIT.none || '', per: {} };
            for (const id of Object.keys(S.GROUNDS)) { S.useGround(id); let inst = 0, kitInst = 0; for (const w of S.world) if (w.isInstancedMesh && w.visible) { inst++; if (w.material.map === S.KIT.tex) kitInst++; } o.per[id] = { built: S.KIT.built, houses: S.BLD.length, kitInst, trees: S.trees.length, kitTrees: S.trees.filter(t => t.material.map === S.KIT.tex).length }; }
            return o; });
        ok(k.ready, 'models: the scenery kit loads', k.none);
        for (const id in k.per) { const q = k.per[id]; ok(q.built && q.houses >= 30 && q.kitInst >= 8 && q.kitTrees === q.trees && q.trees > 0, 'models: ' + id + ' is built with the houses, trees and rocks of the kit', JSON.stringify(q)); }
    }
    ok(!p.errs.length, 'models: no script error', p.errs.join(' | ')); await p.context().close();
}

// the published build, loaded the way the Lab loads it (the page written into the document, the files from the CDN's packs)
//   node tools/tests/ssx.mjs live --build=49 --repo=owner/name
if (want.includes('live')) {
    const arg = n => { const x = process.argv.find(x => x.startsWith('--' + n + '=')); return x ? x.slice(n.length + 3) : ''; }, to = 'https://cdn.jsdelivr.net/gh/' + arg('repo') + '@proof' + arg('build') + '/Steel%20Storm%20Rebuilt/';
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 600 } })).newPage(), errs = [];
    await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { }; });
    page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
    await page.route('http://lab.hg.test/**', r => new URL(r.request().url()).pathname === '/' ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }) : r.fulfill({ status: 404, body: '' }));
    await page.goto('http://lab.hg.test/', { waitUntil: 'load' });      // NOT localhost: there the licence gate of a released game is skipped, and a copied gate goes unnoticed
    await page.evaluate(async to => { const html = await (await fetch(to + 'index.html')).text(), tag = '<script>window.HG_BASE = ' + JSON.stringify(to) + '; window.HG_LAB = 1;</script>'; document.open(); document.write(html.replace(/<head[^>]*>/i, m => m + tag)); document.close(); }, to);
    await page.waitForFunction(() => !!window.__steelstorm && window.__steelstorm.state !== undefined, null, { timeout: 60000 }).catch(() => { });
    const shut = await page.evaluate(() => /shut down|not licen|licence/i.test(document.body ? document.body.innerText : ''));
    ok(!shut, 'live: the page is not refused by a licence gate', await page.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 120)));
    const r = await page.evaluate(async () => { const S = window.__steelstorm; if (!S) return { started: false }; const m = S.makeModel(S.vdef('g1b', 0), 0, 1); for (let i = 0; i < 200 && !S.NEWM.g1b.ready && !S.NEWM.g1b.none; i++) await new Promise(r => setTimeout(r, 100)); S.startMatch({ ground: 'sands', veh: 'g1b', size: 3, mode: 'tdm' }); S.step(60); return { ready: !!S.NEWM.g1b.ready, none: S.NEWM.g1b.none || '', isNew: !!m.isNew, ground: S.ground, state: S.state, n: S.ents().length }; });
    ok(r.ready && r.isNew, 'live: a tank model comes from the CDN packs and is put on', JSON.stringify(r));
    ok(r.ground === 'sands' && r.state === 'match' && r.n === 6, 'live: a battle starts on a chosen battlefield', JSON.stringify(r));
    ok(!errs.length, 'live: no script error', errs.join(' | ')); await page.context().close();
}

console.log((fail ? 'FAILED ' + fail + ', ' : '') + 'passed ' + pass);
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
