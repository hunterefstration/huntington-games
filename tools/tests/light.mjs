// The lighting you prefer (day, sunset, night) and the map you prefer, in Ashfall and in Steel Storm Rebuilt.
//   NODE_PATH="$(npm root -g)" node tools/tests/light.mjs [ashfall ssx]
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const want = process.argv.slice(2).filter(a => !a.startsWith('--')), on = k => !want.length || want.includes(k);
let pass = 0, fail = 0; const ok = (c, name, extra) => { if (c) pass++; else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); } };
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const open = async (url, ready) => { const page = await (await browser.newContext({ viewport: { width: 1366, height: 600 } })).newPage(); page.errs = []; await page.addInitScript(() => { Element.prototype.requestPointerLock = function () { }; }); page.on('pageerror', e => page.errs.push(e.message.slice(0, 200))); await page.goto(base + url, { waitUntil: 'load' }); await page.waitForFunction(ready, null, { timeout: 90000 }); return page; };

if (on('ashfall')) {
    const p = await open('/Ashfall/index.html?gov=0&go=street', () => window.__ash && window.__ash.started !== undefined);
    const r = await p.evaluate(() => {
        const H = window.__ash, W = H.World, R = H.R, at0 = W.lightId + '/' + (R.gradeLo === null || R.gradeLo === undefined); H.Save.data.settings.light = 'night'; W.relight(W.light()); const o = { at0, id: W.lightId, lo: R.gradeLo && R.gradeLo.slice(), exp: R.toneMappingExposure / W.exposure, def: H.Save.data.settings.light, defMap: H.Save.data.settings.map };
        const fog0 = Object.assign({}, W.scene.fog.color); o.back = W.relight('map'); o.loBack = R.gradeLo; o.expBack = R.toneMappingExposure / W.exposure; o.fogMoved = Math.abs(W.scene.fog.color.b - fog0.b) + Math.abs(W.scene.fog.color.r - fog0.r) > 0.01;
        o.sun = W.relight('sunset'); o.hiSun = R.gradeHi && R.gradeHi[0] > R.gradeHi[2]; o.day = W.relight('day'); o.expDay = R.toneMappingExposure / W.exposure;
        // the settings: the choice is kept, 'random' gives one of the three hours, and the PLAY page shows both choices
        H.Save.data.settings.light = 'random'; const seen = new Set(); for (let i = 0; i < 40; i++) seen.add(W.light()); o.random = [...seen].sort().join(',');
        H.Save.data.settings.map = 'random'; H.UI.setup.pref = 0; const picks = new Set(); for (let i = 0; i < 60; i++) picks.add(H.UI.mapPick()); o.maps = picks.size; o.valid = [...picks].every(m => H.UI.maps().includes(m));
        const html = H.UI.playHTML(); o.tile = /data-map="random"/.test(html) && /class="tile sel" data-map="random"/.test(html); o.row = (html.match(/data-seg="light"/g) || []).length; o.set = (H.UI.settingsHTML().match(/data-seg="light"/g) || []).length;
        H.Save.data.settings.map = 'street'; H.UI.setup.pref = 0; o.pref = H.UI.mapPick();
        return o;
    });
    ok(r.id === 'night' && r.lo && r.lo[2] > r.lo[0] && r.exp < 0.8, 'ashfall: night darkens the picture and turns its shadows blue', JSON.stringify(r));
    ok(r.back === 'map' && r.loBack === null && Math.abs(r.expBack - 1) < 1e-6 && r.fogMoved, 'ashfall: "as made" gives the map back exactly, sky and fog too', JSON.stringify(r));
    ok(r.sun === 'sunset' && r.hiSun && r.day === 'day' && r.expDay > 1.2, 'ashfall: sunset warms the bright parts, day lifts the exposure');
    ok(r.def === 'night' && r.at0 === 'map/true' && r.defMap === 'yard', 'ashfall: a new save starts as before (each map in its own light, the Yard first)', r.def + ' / ' + r.defMap);
    ok(r.random === 'day,night,sunset', 'ashfall: RANDOM lighting gives each of the three hours', r.random);
    ok(r.maps >= 3 && r.valid && r.pref === 'street', 'ashfall: RANDOM map picks among the maps that are there, a preferred map is where PLAY starts', r.maps + ' maps, ' + r.pref);
    ok(r.tile && r.row === 5 && r.set === 5, 'ashfall: the PLAY page has the RANDOM tile and the lighting row, Settings has the lighting too', JSON.stringify({ tile: r.tile, row: r.row, set: r.set }));
    ok(!p.errs.length, 'ashfall: no script error', p.errs.join(' | ')); await p.context().close();
}

if (on('ssx')) {
    const p = await open('/Steel%20Storm%20Rebuilt/index.html', () => !!window.__steelstorm && window.__steelstorm.state !== undefined);
    const r = await p.evaluate(async () => {
        const S = window.__steelstorm, R = S.renderer, o = { names: Object.keys(S.WX).map(k => S.WX[k].name).join(','), per: {} };
        S.startMatch({ ground: 'ridge', veh: 'g1b', bots: 'off', mode: 'tdm', wx: 'noon' }); S.step(5);
        for (const k of Object.keys(S.WX)) { const got = S.setWeather(k), W = S.WX[k]; o.per[k] = { got, lo: R.gradeLo === W.lo, hi: R.gradeHi === W.hi, exp: R.toneMappingExposure === W.exp, stars: S.skyU.fx.value.y, lampsOn: !!(S.LAMPS.head && S.LAMPS.head.visible), cones: !!(S.LAMPS.pool && S.LAMPS.pool.visible), n: S.LAMPS.n }; }
        const seen = new Set(); for (let i = 0; i < 40; i++) seen.add(S.setWeather('random')); o.random = seen.size;
        o.opt = S.save.opts.wx; S.leave(); return o;
    });
    ok(r.names === 'Day,Sunset,Rain,Night', 'ssx: the lightings are Day, Sunset, Rain and Night', r.names);
    for (const k in r.per) { const q = r.per[k]; ok(q.got === k && q.lo && q.hi && q.exp, 'ssx: ' + k + ' sets its own exposure and tint', JSON.stringify(q)); }
    ok(r.per.night.stars === 1 && r.per.noon.stars === 0 && r.per.night.lampsOn && r.per.night.cones && !r.per.noon.lampsOn && r.per.night.n > 10, 'ssx: stars and street lamps at night, neither by day', JSON.stringify([r.per.noon, r.per.night]));
    ok(r.random >= 3, 'ssx: "?" gives different lightings', r.random + ' kinds');
    ok(!p.errs.length, 'ssx: no script error', p.errs.join(' | ')); await p.context().close();
}

console.log((fail ? 'FAILED ' + fail + ', ' : '') + 'passed ' + pass);
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
