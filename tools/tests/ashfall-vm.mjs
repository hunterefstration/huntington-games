// (cells show the lower right of a 1280x720 view, where the weapon is: --crop=fx,fy, --full for the whole screen)
// Contact sheets of the first-person weapons as the game draws them: per weapon one picture of 10 cells
// (hip, aimed, run, draw, fire, reload at 5 moments), for checking holds and reloads without playing.
//   node tools/tests/ashfall-vm.mjs <outdir> [ids,comma,separated] [--cell=480x270] [--reload=0.1,0.3,0.5,0.7,0.9]
// Each cell pins the clip at a time (Gun.play + P.vm.t) and draws one frame; the run cell holds W + Shift for a moment.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../bench/serve.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), opt = (n, d) => { const a = process.argv.find(a => a.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const out = args[0] || 'vm-sheets'; fs.mkdirSync(out, { recursive: true });
const [VW, VH] = opt('view', '1280x720').split('x').map(Number), crop = opt('crop', '0.28,0.22').split(',').map(Number), full = process.argv.includes('--full')
const CX = full ? 0 : Math.round(VW * crop[0]), CY = full ? 0 : Math.round(VH * crop[1]), cw = Math.round((VW - CX) / 2), ch = Math.round((VH - CY) / 2), fr = opt('reload', '0.12,0.32,0.5,0.68,0.86').split(',').map(Number);
const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: VW, height: VH } })).newPage();
page.on('pageerror', e => console.log('error: ' + e.message.slice(0, 200)));
await page.goto(base + '/Ashfall/index.html?gov=0&go=yard', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ash && window.__ash.started !== undefined, null, { timeout: 60000 });
const hideHud = () => page.evaluate(() => document.querySelectorAll('body > *').forEach(e => { if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden'; }));
const ids = args[1] ? args[1].split(',') : await page.evaluate(() => Object.keys(window.__ash.WEAPONS));
for (const id of ids) {
    const shots = [];
    const setup = await page.evaluate(async id => {
        const H = window.__ash, G = H.Game, P = G.P;
        if (!H.WEAPONS[id]) return 'no such weapon';
        await H.Gun.load(id); const s = H.WEAPONS[id].slot === 2 ? 2 : 0, ids = [null, null, null]; ids[s] = id; H.Gun.reset(ids); G.slot = s; H.Gun.equip(id, P);
        G.phaseT = 999; H.App.locked = true; P.x = 0; P.z = 0; P.yaw = 0.6; P.pitch = 0.18; for (let i = 0; i < 30; i++) H.step(1 / 30, 1);
        await new Promise(r => setTimeout(r, 400)); for (let i = 0; i < 5; i++) H.step(1 / 30, 1);
        const c = H.Gun.cur.clips; return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.count / v.fps]));
    }, id);
    if (typeof setup === 'string') { console.log(id + ': ' + setup); continue; }
    const states = [['warm-up', null, 0], ['hip', null, 0], ['aimed', 'aim', 0], ['run', 'run', 0], ['draw', 'vm_draw', 0.45], ['fire', 'vm_fire', 1 / 30]];
    for (const f of fr) states.push(['reload ' + Math.round(f * 100) + '%', 'vm_reload', f]);
    for (const [label, what, at] of states) {
        await page.evaluate(([what, at, len]) => {
            const H = window.__ash, G = H.Game, P = G.P; H.keys.KeyW = H.keys.ShiftLeft = false; H.mouse.right = false; H.App.paused = false;
            P.x = 0; P.z = 0; P.yaw = 0.6; P.pitch = 0.18; H.Gun.play(P.vm, 'vm_idle', 0); for (let i = 0; i < 10; i++) H.step(1 / 30, 1);
            if (what === 'aim') { H.mouse.right = true; for (let i = 0; i < 20; i++) H.step(1 / 30, 1); }
            else if (what === 'run') { H.keys.KeyW = H.keys.ShiftLeft = true; for (let i = 0; i < 12; i++) H.step(1 / 30, 1); }
            else if (what) { if (H.Gun.play(P.vm, what, 0)) { P.vm.t = what === 'vm_reload' || what === 'vm_draw' ? at * (len[what] || 1) : at; P.reloadRate = 1; P.vm.fade = 0; } H.step(1e-4, 1); }
            P.x = 0; P.z = 0; H.step(1e-4, 1); H.App.paused = true; H.keys.KeyW = H.keys.ShiftLeft = false;
        }, [what, at, setup]);
        await hideHud(); if (label === 'warm-up') { await page.screenshot(); continue; } shots.push([label, (await page.screenshot({ clip: { x: CX, y: CY, width: VW - CX, height: VH - CY } })).toString('base64')]);
    }
    // stitch: 5 x 2 grid with labels
    const sheet = await (await browser.newContext({ viewport: { width: cw * 5, height: ch * 2 } })).newPage();
    await sheet.setContent('<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(5,' + cw + 'px)">' + shots.map(([l, b]) =>
        `<div style="position:relative;width:${cw}px;height:${ch}px"><img src="data:image/png;base64,${b}" style="width:${cw}px;height:${ch}px"><div style="position:absolute;left:6px;top:4px;font:bold 18px sans-serif;color:#ff0;text-shadow:0 0 3px #000">${id} ${l}</div></div>`).join('') + '</body>');
    await sheet.screenshot({ path: path.join(out, id + '.png') }); await sheet.close();
    console.log(id, 'clips', JSON.stringify(Object.fromEntries(Object.entries(setup).map(([k, v]) => [k, +v.toFixed(2)]))));
}
await browser.close(); server.close(); process.exit(0);
