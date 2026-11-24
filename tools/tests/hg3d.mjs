// HG3D engine test. Needs no rig: serves the checkout itself; three.js comes from the local copy in $HG_TOOLS, or from
// the real CDN when that copy is missing and HG_LIVE_CDN=1 (Windows).
//   node tools/tests/hg3d.mjs                everything
//   node tools/tests/hg3d.mjs demo games     only these parts (demo, games, speed, fallback)
// Checks: the no-three.js demo scene draws (lit, shadowed, coloured) with no engine error; every game that carries the
// engine starts and draws on HG3D and on three.js (?r=three) with no script error or engine warning; the in-game speed
// test runs and stores a result; a shader failure on HG3D makes the game fall back to three.js by itself.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, ROOT } from '../bench/serve.mjs';

const TOOLS = process.env.HG_TOOLS || '/tmp/hg-tools', args = process.argv.slice(2), want = p => !args.length || args.includes(p);
const GAMES = [
    { dir: 'Mayhem Marathon', key: 'mayhem', ready: () => !!window.__mayhem, isHG: () => !!window.__mayhem.GFX.hg, start: () => { const H = window.__mayhem; H.startRound('spin', { bots: 15 }); H.autopilot(true); H.step(5); },
        calls: () => window.__mayhem.renderInfo(true).calls, speedBtn: '#s-speed button' },
    { dir: 'Steel Storm', key: 'steelstorm', ready: () => !!window.__steelstorm, isHG: () => !!window.__steelstorm.renderer.isHG3D, start: () => { const H = window.__steelstorm; H.autoQ(false); H.startMatch({ mode: 'tdm', wx: 'noon' }); },
        calls: () => window.__steelstorm.renderStats(1).calls, speedBtn: '[data-speed]' }
].filter(g => fs.existsSync(path.join(ROOT, g.dir, 'src/js')) && fs.readdirSync(path.join(ROOT, g.dir, 'src/js')).some(f => /hg3d\.js$/.test(f)));

const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
let fails = 0; const ok = (c, what, info) => { console.log((c ? 'PASS  ' : 'FAIL  ') + what + (info ? '  ' + info : '')); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function open(url, init) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage(), msgs = [];
    page.on('pageerror', e => msgs.push('error: ' + e.message.slice(0, 160))); page.on('console', m => { if (/\[HG3D\]/.test(m.text())) msgs.push(m.text().slice(0, 200)); });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await page.route(/three@0\.160\.0\/(.*)$/, r => { const m = /three@0\.160\.0\/(.*)$/.exec(r.request().url()), f = TOOLS + '/cdn/package/' + m[1].split('?')[0]; fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : process.env.HG_LIVE_CDN ? r.continue() : r.abort(); });
    if (init) await page.addInitScript(init);
    await page.goto(base + url);
    return { page, ctx, msgs };
}
// average colour and how many different colours a grid of pixel samples has (a blank or one-colour picture fails)
const sample = gl => { const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4), seen = new Set(); let r = 0, g = 0, b = 0, n = 0; for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) { gl.readPixels(Math.floor((x + 0.5) * w / 16), Math.floor((y + 0.5) * h / 12), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); r += px[0]; g += px[1]; b += px[2]; n++; seen.add((px[0] >> 3) << 10 | (px[1] >> 3) << 5 | (px[2] >> 3)); } return { avg: [Math.round(r / n), Math.round(g / n), Math.round(b / n)], colours: seen.size }; };

if (want('governor')) {
    // the governor's decisions, driven by a fake clock (no browser): a device where a smaller picture buys frames, one
    // where it does not (the processor is the limit), and one that gets headroom back later
    const src = fs.readFileSync(path.join(ROOT, 'engine/hg3d.js'), 'utf8');
    let first = 1; const run = (fpsAt, secs, min, start) => {
        let cb = null, t = 0;
        const HG = new Function('requestAnimationFrame', 'document', 'location', src + '\nreturn HG3D;')(f => { cb = f; }, { hidden: false }, { search: '' });
        let told = 0; const g = HG.governor({ min: min || 0.7, start, onCpuBound: () => told++ }); first = g.scale;
        while (t < secs * 1000 && cb) { const f = cb; cb = null; t += 1000 / fpsAt(g.scale, t / 1000); f(t); }
        return { scale: g.scale, told, first };
    };
    const a = run(s => 38 + (1 - s) * 60, 20), b = run(() => 38, 20), c = run((s, t) => t < 8 ? 38 + (1 - s) * 60 : 60, 45);
    ok(a.scale < 1 && a.scale >= 0.7 && a.told === 0, 'governor: a smaller picture helps -> it settles on one', 'scale=' + a.scale);
    ok(b.scale === 1 && b.told === 1, 'governor: a smaller picture does not help -> full sharpness back, game told the processor is the limit', 'scale=' + b.scale + ' told=' + b.told);
    ok(c.scale === 1 && c.told === 0, 'governor: with headroom again it climbs back to the full picture', 'scale=' + c.scale);
    const d = run(s => 20 + (1 - s) * 80, 9, 0.5), e = run(s => 20 + (1 - s) * 80, 1.5, 0.5, 0.6);
    ok(d.scale <= 0.6, 'governor: far too slow -> it takes double steps (the right size inside nine seconds)', 'scale=' + d.scale);
    ok(e.first === 0.6 && e.scale === 0.6, 'governor: it starts at the size this device settled on last time', 'first=' + e.first);
}
if (want('demo')) {
    const { page, ctx, msgs } = await open('engine/demo.html?n=800');
    await page.waitForFunction(() => window.__hgdemo && window.__hgdemo.R.info.render.frame > 20, null, { timeout: 30000 }).catch(() => { });
    const r = await page.evaluate(src => { const D = window.__hgdemo; if (!D) return null; D.R.render(D.scene, D.cam); return Object.assign((0, eval)('(' + src + ')')(D.R.getContext()), { calls: D.R.info.render.calls, tris: D.R.info.render.triangles, failed: D.failed, three: typeof THREE !== 'undefined' }); }, sample.toString());
    ok(r && !r.failed && !msgs.length, 'demo: the engine starts with no error or warning', r ? (r.failed || msgs.join(' | ')) : 'no demo');
    ok(r && r.colours >= 12 && r.calls >= 5 && r.calls <= 12 && r.tris > 9000, 'demo: a lit, coloured scene in a handful of draw calls', r && `colours=${r.colours} calls=${r.calls} tris=${r.tris} avg=${r.avg}`);
    ok(r && r.three === false, 'demo: no three.js on the page');
    // a lost graphics context (it happens on a 4 GB device under memory pressure): once it is back the engine rebuilds its programs, buffers and textures by itself
    const back = await page.evaluate(async src => {
        const D = window.__hgdemo, gl = D.R.getContext(), ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return { skip: true };
        ext.loseContext(); await new Promise(res => setTimeout(res, 300)); const lostSeen = gl.isContextLost(); ext.restoreContext(); await new Promise(res => setTimeout(res, 900));
        D.R.render(D.scene, D.cam); return Object.assign((0, eval)('(' + src + ')')(gl), { failed: D.failed, lost: gl.isContextLost(), lostSeen, calls: D.R.info.render.calls });
    }, sample.toString());
    ok(back && (back.skip || (back.lostSeen && !back.lost && !back.failed && back.colours >= 12 && back.calls >= 5)), 'demo: draws again after the graphics context was lost and restored', JSON.stringify(back).slice(0, 160));
    await ctx.close();
}
for (const G of GAMES) {
    const url = encodeURIComponent(G.dir) + '/index.html';
    if (want('games')) {
        const pics = {};
        for (const r of ['hg', 'three']) {
            const { page, ctx, msgs } = await open(url + '?r=' + r);
            const up = await page.waitForFunction(G.ready, null, { timeout: 60000 }).then(() => true, () => false);
            if (!up) { ok(false, `${G.dir} (${r}): starts`, msgs.join(' | ')); await ctx.close(); continue; }
            await page.evaluate(G.start); await sleep(2500);
            const hg = await page.evaluate(G.isHG), calls = await page.evaluate(G.calls);
            pics[r] = await page.evaluate(src => { const c = document.querySelector('canvas'), gl = c.getContext('webgl2'); return (0, eval)('(' + src + ')')(gl); }, sample.toString()).catch(() => null);
            ok(hg === (r === 'hg') && calls > 5 && !msgs.length, `${G.dir} (${r === 'hg' ? 'HG3D' : 'three.js'}): starts a match and draws, no errors`, `calls=${calls}` + (msgs.length ? ' ' + msgs.slice(0, 3).join(' | ') : ''));
            await ctx.close();
        }
    }
    if (want('speed')) {
        const { page, ctx, msgs } = await open(url + '?r=hg');
        await page.waitForFunction(G.ready, null, { timeout: 60000 });
        await page.evaluate(sel => document.querySelector(sel).click(), G.speedBtn);
        const res = await page.waitForFunction(k => { try { const o = JSON.parse(localStorage.getItem('hgdev_bench_' + k) || '{}'); return o.hg || null; } catch (e) { return null; } }, G.key, { timeout: 60000 }).then(h => h.jsonValue(), () => null);
        const card = await page.evaluate(() => /needs|Run the test once/.test(document.body.innerText));
        ok(res && res.frames > 60 && res.ms > 0 && res.fps > 1 && card && !msgs.length, `${G.dir}: the speed test runs, stores its result and shows the card`, res ? `fps=${res.fps} ms=${res.ms} frames=${res.frames}` : msgs.join(' | '));
        await ctx.close();
    }
    if (want('fallback')) {
        // HG3D's shaders fail to compile on this "device" (three.js' own are left alone): the game must end up on three.js
        const init = `(() => { const k = 'hgdev_r_${G.key}', P = WebGL2RenderingContext.prototype, real = P.getShaderParameter; P.getShaderParameter = function (s, p) { if (localStorage.getItem(k) !== 'three' && p === this.COMPILE_STATUS) return false; return real.call(this, s, p); }; })();`;
        const { page, ctx } = await open(url, init);
        await page.waitForFunction(G.ready, null, { timeout: 60000 }).catch(() => { });
        await page.evaluate(G.start).catch(() => { });
        const done = await page.waitForFunction(([k, src]) => { try { return localStorage.getItem('hgdev_r_' + k) === 'three' && (0, eval)('(' + src + ')')() && !(0, eval)('(' + src + ')')() === false; } catch (e) { return false; } }, [G.key, G.ready.toString()], { timeout: 60000 }).then(() => true, () => false);
        await sleep(1500);
        const state = await page.evaluate(([a, b]) => { try { return { ready: (0, eval)('(' + a + ')')(), hg: (0, eval)('(' + b + ')')() }; } catch (e) { return { err: String(e.message) }; } }, [G.ready.toString(), G.isHG.toString()]);
        ok(done && state.ready && state.hg === false, `${G.dir}: a failing HG3D start falls back to three.js by itself`, JSON.stringify(state));
        await ctx.close();
    }
}
await browser.close(); server.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
