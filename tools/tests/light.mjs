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
    // the owner: "no light settings for ashfall. Make the whole thing a bit darker but add more crystals to light up the map"
    const p = await open('/Ashfall/index.html?gov=0&go=street', () => window.__ash && window.__ash.started !== undefined);
    const r = await p.evaluate(() => {
        const H = window.__ash, W = H.World, R = H.R, o = { exp: R.toneMappingExposure / W.exposure, lo: R.gradeLo && R.gradeLo.slice(), glowOn: H.App.glow, glowDid: H.App.glowDraw(), glows: W.glows.length, defMap: H.Save.data.settings.map, hasLight: 'light' in H.Save.data.settings };
        H.Save.data.settings.map = 'random'; H.UI.setup.pref = 0; const picks = new Set(); for (let i = 0; i < 60; i++) picks.add(H.UI.mapPick()); o.maps = picks.size; o.valid = [...picks].every(m => H.UI.maps().includes(m));
        const html = H.UI.playHTML(); o.tile = /class="tile sel" data-map="random"/.test(html); o.row = (html.match(/data-seg="light"/g) || []).length + (H.UI.settingsHTML().match(/data-seg="light"/g) || []).length; o.word = /Lighting/.test(html + H.UI.settingsHTML());
        H.Save.data.settings.map = 'street'; H.UI.setup.pref = 0; o.pref = H.UI.mapPick();
        H.Save.data.settings.quality = 'low'; o.glowLow = H.App.glowDraw(); H.Save.data.settings.quality = 'auto';
        return o;
    });
    ok(r.exp > 0.5 && r.exp < 0.72 && r.lo && r.lo[2] > r.lo[0] + 0.25, 'ashfall: every map is shown well under the brightness it was tuned to, and pulled to blue', JSON.stringify(r));
    ok(r.row === 0 && !r.word && !r.hasLight, 'ashfall: there is no lighting setting, on the PLAY page or in Settings', JSON.stringify({ row: r.row, word: r.word, has: r.hasLight }));
    ok(r.glowOn && r.glowDid === true && r.glowLow === false && r.glows > 10, 'ashfall: the glow is on round the crystals and lamps, and off on the LOW picture setting', JSON.stringify({ on: r.glowOn, did: r.glowDid, low: r.glowLow, glows: r.glows }));
    ok(r.defMap === 'yard' && r.maps >= 3 && r.valid && r.pref === 'street' && r.tile, 'ashfall: the preferred map stays: the Yard at first, a RANDOM tile, a chosen map is where PLAY starts', JSON.stringify({ def: r.defMap, maps: r.maps, pref: r.pref, tile: r.tile }));
    ok(!p.errs.length, 'ashfall: no script error', p.errs.join(' | ')); await p.context().close();
}

if (on('ssx')) {
    // the old game's own grounds (?tiles=0: what three.js plays on) have the sky, stars and street lamps; the tile battlefields are checked after
    const p = await open('/Steel%20Storm%20Rebuilt/index.html?tiles=0', () => !!window.__steelstorm && window.__steelstorm.booted);
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
    const q = await open('/Steel%20Storm%20Rebuilt/index.html', () => !!window.__steelstorm && window.__steelstorm.booted);
    const t = await q.evaluate(() => { const S = window.__steelstorm, o = { on: S.TILE.on, id: S.TILE.id }; S.startMatch({ veh: 'g1b', bots: 'off', mode: 'tdm', wx: 'noon' }); S.step(5); for (const k of Object.keys(S.WX)) { S.setWeather(k); S.draw(); o[k] = { exp: S.TILE.expNow, lo: S.renderer.gradeLo === S.WX[k].lo, fog: S.scene.fog.color.r + S.scene.fog.color.g + S.scene.fog.color.b }; } S.leave(); return o; });
    ok(t.on && t.noon.exp > t.evening.exp && t.evening.exp > t.overcast.exp && t.overcast.exp > t.night.exp * 2 && t.night.lo && t.noon.fog > t.night.fog * 2, 'ssx: on a tile battlefield each lighting shows the baked light and the sky brighter or darker, with its own tint', JSON.stringify(t));
    ok(!q.errs.length, 'ssx: no script error on a tile', q.errs.join(' | ')); await q.context().close();
}

console.log((fail ? 'FAILED ' + fail + ', ' : '') + 'passed ' + pass);
await browser.close(); server.close(); process.exit(fail ? 1 : 0);
