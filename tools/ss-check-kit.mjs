// Steel Storm Rebuilt: does the scenery kit (Steel Storm Rebuilt/assets/s_kit.hgm) fit what the game does with it?
//   node tools/ss-check-kit.mjs
// Game axes: +Y up, metres. Every part unparented, no transform of its own. The game stretches a house over the box the
// old code-made house filled (scale w, h, d from a unit box) and a roof over (w + 0.8, half the shorter side, d + 0.8);
// trees and rocks are scaled evenly. Materials by name: walls and roof are tinted per house, foliage per battlefield.
import fs from 'node:fs';
const f = 'Steel Storm Rebuilt/assets/s_kit.hgm';
if (!fs.existsSync(f)) { console.log('FAIL ' + f + ' is missing'); process.exit(1); }
const buf = fs.readFileSync(f), J = JSON.parse(buf.slice(8, 8 + buf.readUInt32LE(4)).toString()), errs = [], obj = {};
for (const o of J.objects) {
    let b = null, tris = 0; for (const p of o.prims || []) { tris += p.index.n / 3; b = b ? [0, 1, 2].map(i => Math.min(b[i], p.min[i])).concat([0, 1, 2].map(i => Math.max(b[i + 3], p.max[i]))) : p.min.concat(p.max); }
    if (o.parent) errs.push(o.name + ' has a parent');
    if (o.local && o.local.some((x, i) => Math.abs(x - (i % 5 === 0 ? 1 : 0)) > 1e-4)) errs.push(o.name + ' has a transform of its own (apply it)');
    obj[o.name] = { box: b, tris, mats: [...new Set((o.prims || []).map(p => J.materials[p.material].name))] };
}
// name: [box min/max the part must stay inside, the least it must fill (fraction of that box on x, y, z), most triangles, materials allowed, materials required]
const UNIT = [-0.54, -0.02, -0.54, 0.54, 1.02, 0.54];
const WANT = {
    house2: [UNIT, [.95, .97, .95], 220, ['walls', 'trim'], ['walls', 'trim']], house3: [UNIT, [.95, .97, .95], 240, ['walls', 'trim'], ['walls', 'trim']],
    house4: [UNIT, [.95, .97, .95], 260, ['walls', 'trim'], ['walls', 'trim']], house5: [UNIT, [.95, .97, .95], 280, ['walls', 'trim'], ['walls', 'trim']],
    roof1: [[-0.5, -0.02, -0.5, 0.5, 1.3, 0.5], [.97, .7, .97], 120, ['roof', 'trim'], ['roof']], roof2: [[-0.5, -0.02, -0.5, 0.5, 1.3, 0.5], [.97, .7, .97], 120, ['roof', 'trim'], ['roof']],
    pine: [[-2.5, -0.3, -2.5, 2.5, 8, 2.5], [.6, .8, .6], 140, ['bark', 'foliage'], ['bark', 'foliage']], leaf: [[-2.7, -0.3, -2.7, 2.7, 7.4, 2.7], [.6, .75, .6], 140, ['bark', 'foliage'], ['bark', 'foliage']],
    palm: [[-2.8, -0.3, -2.8, 2.8, 8, 2.8], [.5, .75, .5], 140, ['bark', 'foliage'], ['bark', 'foliage']],
    rock1: [[-1.15, -0.5, -1.15, 1.15, 1.15, 1.15], [.7, .5, .7], 80, ['rock'], ['rock']], rock2: [[-1.15, -0.5, -1.15, 1.15, 1.15, 1.15], [.7, .5, .7], 80, ['rock'], ['rock']]
};
for (const n in WANT) {
    const [box, fill, maxT, allow, need] = WANT[n], o = obj[n]; if (!o || !o.box) { errs.push('part ' + n + ' is missing'); continue; }
    for (let i = 0; i < 3; i++) { const ax = 'xyz'[i]; if (o.box[i] < box[i] - 1e-3 || o.box[i + 3] > box[i + 3] + 1e-3) errs.push(n + ' is outside its box on ' + ax + ': ' + o.box[i].toFixed(2) + '..' + o.box[i + 3].toFixed(2) + ' (allowed ' + box[i] + '..' + box[i + 3] + ')'); else if (o.box[i + 3] - o.box[i] < (box[i + 3] - box[i]) * fill[i] * (/house|roof/.test(n) ? 1 / 1.08 : 1)) errs.push(n + ' is too small on ' + ax + ': ' + (o.box[i + 3] - o.box[i]).toFixed(2)); }
    if (/^house/.test(n) && (o.box[1] > 0.005 || o.box[4] < 0.995)) errs.push(n + ' walls must run from y = 0 to y = 1');
    if (o.tris > maxT) errs.push(n + ' has ' + Math.round(o.tris) + ' triangles (limit ' + maxT + ')');
    for (const m of o.mats) if (!allow.includes(m)) errs.push(n + ' uses material ' + m + ' (allowed: ' + allow.join(', ') + ')');
    for (const m of need) if (!o.mats.includes(m)) errs.push(n + ' needs a part in material ' + m);
}
for (const n in obj) if (!WANT[n]) errs.push('unexpected part ' + n);
const tex = J.textures || []; if (tex.length !== 1) errs.push('expected one picture, found ' + tex.length); else if (tex[0].w > 1024 || tex[0].h > 1024) errs.push('the picture is ' + tex[0].w + ' px (limit 1024)');
if (errs.length) { console.log('FAIL: ' + errs.slice(0, 10).join('; ') + (errs.length > 10 ? ' (+' + (errs.length - 10) + ' more)' : '')); process.exit(1); }
console.log('kit ok: ' + Object.keys(obj).map(n => n + ' ' + Math.round(obj[n].tris)).join(', ') + '; ' + Math.round(buf.length / 1024) + ' KB');
