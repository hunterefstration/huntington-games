// scratch: node art/nightline/_hgm.mjs  -> prints the exported quay.hgm header summary (bounds, counts, glows, sample check)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const b = fs.readFileSync(path.join(root, 'Nightline/assets/quay.hgm')); const n = b.readUInt32LE(4); const J = JSON.parse(b.slice(8, 8 + n).toString('utf8'));
const tris = J.objects.flatMap(o => o.prims).reduce((s, p) => s + p.tris, 0);
console.log('bytes', b.length, 'bounds', JSON.stringify(J.bounds), 'tris', tris, 'materials', J.materials.length, 'textures', J.textures.length, 'meshes', J.objects.reduce((s, o) => s + o.prims.length, 0), 'glows', (J.glows || []).length, 'sun', JSON.stringify(J.sun), 'exposure', J.exposure, 'sky', JSON.stringify(J.sky && { range: J.sky.range }));
const trk = JSON.parse(fs.readFileSync(path.join(root, 'art/nightline/quay.track.json'), 'utf8'));
const s0 = trk.s[0]; const g = J.glows || [];
console.log('sample 0 (game):', s0.slice(0, 3), ' hgm bounds x', J.bounds.min[0], J.bounds.max[0], 'z', J.bounds.min[2], J.bounds.max[2]);
// nearest glow to sample 0 (the start gantry's red lights are about 6.2 m up, 0.8 m behind the beam): game axes
let best = 1e9, bg = null; for (const q of g) { const d = Math.hypot(q[0] - s0[0], q[2] - s0[2]); if (d < best && q[1] > 6 && q[1] < 9 && q[3] > 0.9 && q[4] < 0.3) { best = d; bg = q; } }
console.log('red glow nearest sample 0 (start lights):', JSON.stringify(bg), 'dist', best.toFixed(2));
for (const [i, t] of [[0, 'start'], [150, 'bridge'], [380, 'tunnel']]) { const s = trk.s[i]; let bd = 1e9; for (const q of g) bd = Math.min(bd, Math.hypot(q[0] - s[0], q[2] - s[2])); console.log(t, 'sample', i, 'game', s.slice(0, 3), 'nearest glow', bd.toFixed(1), 'm'); }
