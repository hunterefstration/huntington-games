// Steel Storm Rebuilt: writes art/steelstorm/rebuilt/vehicles.json, the measurements the Blender models must keep.
// For each of the game's vehicles: its own model numbers (m), and what the game's old box model worked out from them:
// where the turret and gun turn, where the muzzles, propellers and ship turrets sit, and the box each part fills.
// The new models are built to these, so every hit box, pivot and muzzle in the game stays exactly where it was.
//   node tools/ss-parts.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './bench/serve.mjs';

const { server, base } = await startServer(0);
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('error: ' + e.message.slice(0, 300)));
await page.goto(base + '/Steel%20Storm%20Rebuilt/index.html?old=1', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__steelstorm, null, { timeout: 30000 });
const out = await page.evaluate(() => {
    const S = window.__steelstorm, r = v => Math.round(v * 1000) / 1000;
    const box = g => { if (!g) return null; g.computeBoundingBox(); const b = g.boundingBox; return [r(b.min.x), r(b.min.y), r(b.min.z), r(b.max.x), r(b.max.y), r(b.max.z)]; };
    const v3 = p => p ? [r(p[0]), r(p[1]), r(p[2])] : null;
    return S.VEHS.map(v => {
        const P = S.getParts(v, 0), o = { id: v.id, name: v.n, tier: v.t, line: v.ln, cls: v.cls, heli: !!v.heli, sub: !!v.sub, radius: r(v.r), m: v.m };
        o.body = box(P.body); o.kitBody = box(P.kitB);
        if (v.ln === 'g') { o.track = box(P.track); o.turret = box(P.tur); o.kitTurret = box(P.kitT); o.gun = box(P.gun); o.turretPivot = v3(P.tpos); o.gunPivot = v3(P.gpos); o.muzzle = v3(P.muz[0]); }
        else if (v.ln === 'a') { o.props = (P.props || []).map(p => ({ pos: v3(p.pos), axis: p.ax, box: box(p.geo) })); o.muzzles = (P.muz || []).map(v3); }
        else { o.turrets = (P.turs || []).map(t => ({ pos: v3(t.pos), muzzle: [r(t.muz[0]), r(t.muz[1])], box: box(t.geo) })); o.len = r(P.len || 0); o.w = r(P.w || 0); }
        return o;
    });
});
fs.mkdirSync('art/steelstorm/rebuilt', { recursive: true });
fs.writeFileSync('art/steelstorm/rebuilt/vehicles.json', JSON.stringify(out, null, 1));
console.log('wrote ' + out.length + ' vehicles: ' + ['g', 'a', 'n'].map(l => l + ' ' + out.filter(v => v.line === l).length).join(', '));
await browser.close(); server.close(); process.exit(0);
