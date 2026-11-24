// Pixel cost of every Ashfall map and Steel Storm ground on this computer's real graphics chip (hidden browser, an 8K
// picture so the chip, not the processor, is the limit). Not a Chromebook's speed: numbers to compare maps and effects
// with, and to see what the "lite" steps buy.
//   node tools/tests/pixels.mjs                 everything
//   node tools/tests/pixels.mjs ash yard mall   only Ashfall, only these maps      (ssr farmland ... the same for Steel Storm)
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const parts = process.argv.slice(2).filter(a => !a.startsWith('--'));
const ASH = ['yard', 'street', 'outpost', 'carnival', 'depot', 'mall', 'subway', 'lab'];
const SSR = ['range', 'farmland', 'valley', 'city', 'harbor', 'dunes', 'pass', 'works'];
const pick = (all, tag) => { if (parts.length && !parts.includes(tag) && (parts.includes('ash') || parts.includes('ssr'))) return []; const named = all.filter(m => parts.includes(m)); return named.length ? named : (parts.some(p => ASH.includes(p) || SSR.includes(p)) ? [] : all); };
const { server, base } = await startServer(0);
const real = await chromium.launch({ args: ['--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });

async function measure(url, hook, label) {
    const ctx = await real.newContext({ viewport: { width: 1920, height: 1080 } }), page = await ctx.newPage();
    try {
        await page.goto(base + url, { waitUntil: 'load', timeout: 90000 });
        await page.waitForFunction(h => window[h] && window[h].started !== undefined, hook, { timeout: 120000 });
        const r = await page.evaluate(async hook => {
            const H = window[hook], gl = H.R.getContext(), px = new Uint8Array(4), out = {}; H.App.locked = true;
            const P = H.Game.P; for (let i = 0; i < 150; i++) { if (P) P.hp = P.max; H.step(1 / 30, 1); }
            const time = async () => { const t = []; for (let i = 0; i < 90; i++) { if (P) P.hp = P.max; const a = performance.now(); H.step(1 / 30, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - a); if (i % 16 === 15) await new Promise(r => setTimeout(r, 0)); } t.sort((a, b) => a - b); return t[45]; };
            for (const n of [0, 1, 2]) { H.App.setLite(n); for (let i = 0; i < 20; i++) H.step(1 / 30, 1); out['l' + n] = await time(); }
            H.App.setLite(0); out.mp = gl.drawingBufferWidth * gl.drawingBufferHeight / 1e6; out.calls = H.App.calls; out.tris = H.App.tris; out.mb = H.R.info.memory.textureBytes / 1048576;
            const e = gl.getExtension('WEBGL_debug_renderer_info'); out.gpu = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; return out;
        }, hook);
        console.log(label.padEnd(22) + (r.l0 / r.mp).toFixed(3) + ' ms/Mpx   lite1 ' + (r.l1 / r.mp).toFixed(3) + '   lite2 ' + (r.l2 / r.mp).toFixed(3) + '   ' + r.calls + ' draws  ' + Math.round(r.tris / 1000) + 'k tris  ' + r.mb.toFixed(0) + ' MB   (' + r.mp.toFixed(0) + ' Mpx)');
        return r;
    } catch (e) { console.log(label.padEnd(22) + 'FAILED  ' + String(e.message).slice(0, 120)); }
    finally { await ctx.close(); }
}
// "cpu": the processor's share of a frame in a full fight, with this computer slowed six times (roughly a school
// Chromebook's processor), at a small picture so the chip is not the limit. Split into the game's own work and the drawing.
async function cpu(url, hook, label, heat) {
    const ctx = await real.newContext({ viewport: { width: 960, height: 540 } }), page = await ctx.newPage();
    try {
        await page.goto(base + url, { waitUntil: 'load', timeout: 90000 });
        await page.waitForFunction(h => window[h] && window[h].started !== undefined, hook, { timeout: 120000 });
        await page.evaluate(heat);
        const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
        const r = await page.evaluate(async hook => {
            const H = window[hook], P = H.Game.P, t = [], d = []; const rr = H.R.render; let dt = 0; H.R.render = function () { const a = performance.now(); const v = rr.apply(this, arguments); dt += performance.now() - a; return v; };
            for (let i = 0; i < 240; i++) { if (P) P.hp = P.max; dt = 0; const a = performance.now(); H.step(1 / 30, 1); t.push(performance.now() - a); d.push(dt); if (i % 16 === 15) await new Promise(r => setTimeout(r, 0)); }
            H.R.render = rr; const s = a => a.slice().sort((x, y) => x - y);
            return { med: s(t)[120], p95: s(t)[228], max: s(t)[239], draw: s(d)[120], n: hook === '__ash' ? H.Foes.list.length : H.Units.list.filter(u => !u.dead).length, calls: H.App.calls };
        }, hook);
        console.log(label.padEnd(26) + 'frame ' + r.med.toFixed(1) + ' ms (95% under ' + r.p95.toFixed(1) + ', worst ' + r.max.toFixed(1) + ')   drawing ' + r.draw.toFixed(1) + ' ms   ' + r.n + ' in the fight, ' + r.calls + ' draws');
    } catch (e) { console.log(label.padEnd(26) + 'FAILED  ' + String(e.message).slice(0, 160)); }
    finally { await ctx.close(); }
}
if (parts.includes('cpu')) {
    const ash = () => { const H = window.__ash, G = H.Game, P = G.P; H.App.locked = true; G.wave = 14; for (let i = 0; i < 900; i++) { P.hp = P.max; if (G.phase === 'break') G.phaseT = Math.min(G.phaseT, 0.2); H.step(1 / 30, 1); if (H.Foes.list.length >= 30) break; } };
    const ssr = () => { const H = window.__ssr, G = H.Game, P = G.P; H.App.locked = true; for (let i = 0; i < 300; i++) { P.hp = P.max; H.step(1 / 30, 1); } };
    for (const m of ['yard', 'mall']) await cpu('/Ashfall/index.html?gov=0&go=' + m, '__ash', 'ashfall ' + m + ' (cpu)', ash);
    for (const m of ['city', 'farmland']) await cpu('/Steel%20Storm%20Remastered/index.html?gov=0&go=1&mode=tdm&size=8&ground=' + m, '__ssr', 'steel storm ' + m + ' (cpu)', ssr);
    await real.close(); server.close(); process.exit(0);
}
let gpu = '';
for (const m of pick(ASH, 'ash')) { const r = await measure('/Ashfall/index.html?gov=0&pr=4&go=' + m, '__ash', 'ashfall ' + m); if (r) gpu = r.gpu; }
for (const m of pick(SSR, 'ssr')) { const r = await measure('/Steel%20Storm%20Remastered/index.html?gov=0&pr=4&go=1&ground=' + m, '__ssr', 'steel storm ' + m); if (r) gpu = r.gpu; }
console.log('chip: ' + gpu.slice(0, 80));
await real.close(); server.close();
