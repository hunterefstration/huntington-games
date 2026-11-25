// Steel Storm Rebuilt: does a new vehicle model keep the old vehicle's measurements?
//   node tools/ss-check-model.mjs [id ...]        (no ids: every v_<id>.hgm in "Steel Storm Rebuilt/assets")
// Reads assets/v_<id>.hgm and art/steelstorm/rebuilt/vehicles.json (from tools/ss-parts.mjs). Game axes: +Y up, +Z forward
// (the gun points along +Z), metres, the origin on the ground under the middle of the hull. Every object must be saved in
// VEHICLE space, assembled, gun level and turret forward, with no parent and no transform of its own.
import fs from 'node:fs';
const DIR = 'Steel Storm Rebuilt/assets/', V = JSON.parse(fs.readFileSync('art/steelstorm/rebuilt/vehicles.json', 'utf8'));
const TOL = 0.2, MAX_TRIS = 16000, MAX_SKIN = 1024;      // 2026-11-24: the realism pass (baked occlusion, weathering, real running gear) needs the room
let ids = process.argv.slice(2); if (!ids.length) ids = fs.readdirSync(DIR).filter(f => /^v_.*\.hgm$/.test(f)).map(f => f.slice(2, -4));
let bad = 0;
const add3 = (b, p) => b && [b[0] + p[0], b[1] + p[1], b[2] + p[2], b[3] + p[0], b[4] + p[1], b[5] + p[2]];
for (const id of ids) {
    const v = V.find(x => x.id === id), errs = [], f = DIR + 'v_' + id + '.hgm';
    if (!v) { console.log('FAIL ' + id + ': not a vehicle of the game'); bad++; continue; }
    if (!fs.existsSync(f)) { console.log('FAIL ' + id + ': ' + f + ' is missing'); bad++; continue; }
    const buf = fs.readFileSync(f), J = JSON.parse(buf.slice(8, 8 + buf.readUInt32LE(4)).toString());
    const obj = {}; let tris = 0;
    for (const o of J.objects) {
        const n = o.name.replace(id + '_', ''); let b = null;
        for (const p of o.prims || []) { tris += p.index.n / 3; b = b ? [0, 1, 2].map(i => Math.min(b[i], p.min[i])).concat([0, 1, 2].map(i => Math.max(b[i + 3], p.max[i]))) : p.min.concat(p.max); }
        if (o.parent !== undefined && o.parent !== null && o.parent !== -1) errs.push(o.name + ' has a parent (save every part unparented, in vehicle space)');
        if (o.local && o.local.some((x, i) => Math.abs(x - (i % 5 === 0 ? 1 : 0)) > 1e-4)) errs.push(o.name + ' has a transform of its own (apply it)');
        obj[n] = { box: b, mats: (o.prims || []).map(p => J.materials[p.material].name) };
    }
    // the old part boxes, in vehicle space
    const want = { body: v.body };
    if (v.line === 'g') { const tp = v.turretPivot, gp = [tp[0] + v.gunPivot[0], tp[1] + v.gunPivot[1], tp[2] + v.gunPivot[2]]; want.track = v.track; want.tur = add3(v.turret, tp); want.gun = add3(v.gun, gp); if (v.kitBody) want.kitb = v.kitBody; if (v.kitTurret) want.kitt = add3(v.kitTurret, tp);
        // the barrel ends at the muzzle; where the old model's muzzle point hung in the air ahead of its gun (missile launchers), the new gun ends where the old one did
        const mz0 = gp[2] + v.muzzle[2], tip = gp[2] + v.gun[5], far = v.m.ty === 'ml', mz = far ? tip : mz0, g = obj.gun; if (g && g.box && Math.abs(g.box[5] - mz) > (far ? 0.2 : 0.12)) errs.push('gun ends at z ' + g.box[5].toFixed(2) + ', it should end at ' + mz.toFixed(2));
        if (g && g.box && (v.m.gun[2] || 1) === 1 && Math.abs((g.box[0] + g.box[3]) / 2) > 0.05) errs.push('a single barrel must be on the centre line (x = 0)');
        if (g && g.box) { const ax = gp[1]; if (ax < g.box[1] - 0.02 || ax > g.box[4] + 0.02) errs.push('the barrel is not at the trunnion height ' + ax.toFixed(2)); }
    } else if (v.line === 'a') { v.props.forEach((p, i) => want['prop' + i] = add3(p.box, p.pos)); if (v.kitBody) want.kitb = v.kitBody; }
    else { v.turrets.forEach((t, i) => want['tur' + i] = add3(t.box, t.pos)); if (v.kitBody) want.kitb = v.kitBody; }
    for (const k in want) {
        const w = want[k], o = obj[k]; if (!w) continue;
        if (!o || !o.box) { errs.push('part ' + id + '_' + k + ' is missing'); continue; }
        const b = o.box;
        for (let i = 0; i < 3; i++) {
            const ax = 'xyz'[i], lo = w[i], hi = w[i + 3], size = hi - lo;
            if (b[i] < lo - TOL || b[i + 3] > hi + TOL) errs.push(k + ' sticks out of the old part on ' + ax + ': ' + b[i].toFixed(2) + '..' + b[i + 3].toFixed(2) + ' (old ' + lo.toFixed(2) + '..' + hi.toFixed(2) + ')');
            else if (/^(body|tur|gun|track|tur\d)$/.test(k) && size > 0.6 && (b[i + 3] - b[i]) < size * 0.8) errs.push(k + ' is too small on ' + ax + ': ' + (b[i + 3] - b[i]).toFixed(2) + ' m (old ' + size.toFixed(2) + ')');
        }
    }
    for (const k in obj) if (!want[k]) errs.push('unexpected part ' + k);
    if (obj.track && obj.track.mats.some(m => m !== 'track')) errs.push('the track part must use one material named "track" (the game puts its own moving picture on it)');
    for (const k in obj) if (k !== 'track' && obj[k].mats.some(m => m !== id + '_skin' && m !== id + '_gear')) errs.push(k + ' may only use the materials ' + id + '_skin (paint) and ' + id + '_gear (everything unpainted)');
    const tex = J.textures || []; if (tex.length !== 1) errs.push('expected one picture (the skin), found ' + tex.length); else if (tex[0].w > MAX_SKIN || tex[0].h > MAX_SKIN) errs.push('skin is ' + tex[0].w + ' px (limit ' + MAX_SKIN + ')');
    if (tris > MAX_TRIS) errs.push(Math.round(tris) + ' triangles (limit ' + MAX_TRIS + ')');
    const kb = Math.round(buf.length / 1024);
    if (errs.length) { bad++; console.log('FAIL ' + id + ' (' + v.name + '): ' + errs.slice(0, 6).join('; ') + (errs.length > 6 ? ' (+' + (errs.length - 6) + ' more)' : '')); }
    else console.log('ok   ' + id + ' ' + v.name + ': ' + Math.round(tris) + ' triangles, ' + kb + ' KB');
}
console.log(bad ? bad + ' of ' + ids.length + ' failed' : 'all ' + ids.length + ' passed');
process.exit(bad ? 1 : 0);
