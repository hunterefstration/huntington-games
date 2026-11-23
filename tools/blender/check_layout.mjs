// node tools/blender/check_layout.mjs <ground> [--w=9] [--png out.png]: budgets + the game's base/point choice + 9 m route check on an exported Steel Storm ground
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), A = ROOT + '/Steel Storm Remastered/assets/';
const g = process.argv[2], file = A + (g === 'range' ? 'range' : g) + '.hgm';
const buf = fs.readFileSync(file), n = buf.readUInt32LE(4), J = JSON.parse(buf.toString('utf8', 8, 8 + n)), blob = buf.subarray(8 + n);
const view = d => new Float32Array(blob.buffer.slice(blob.byteOffset + d.off, blob.byteOffset + d.off + d.n * 4));
const H = J.heights, hd = view(H.data), td = view(H.tops), nx = H.nx, nz = H.nz, c = H.cell;
// budgets
const world = J.objects.find(o => o.world); const prims = world.prims; const tris = prims.reduce((s, p) => s + p.tris, 0);
const allTris = J.objects.reduce((s, o) => s + (o.prims || []).reduce((t, p) => t + (p.tris || 0), 0), 0);
let mb = 0; for (const f of fs.readdirSync(A)) if (f.startsWith(g + (g === 'range' ? '' : '')) && (f.startsWith(g + '.') || f.startsWith(g + '_'))) mb += fs.statSync(A + f).size;
console.log(`${g}: world draw calls ${prims.length}, world tris ${tris}, all tris ${allTris}, files ${(mb / 1048576).toFixed(1)} MB, hgm ${(buf.length / 1048576).toFixed(1)} MB`);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function sampleH(d, x, z) { let fx = (x - H.x0) / c, fz = (z - H.z0) / c; fx = clamp(fx, 0, nx - 1.001); fz = clamp(fz, 0, nz - 1.001); const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, a = iz * nx + ix; return (d[a] * (1 - tx) + d[a + 1] * tx) * (1 - tz) + (d[a + nx] * (1 - tx) + d[a + nx + 1] * tx) * tz; }
const B = J.bounds, mid = [(B.min[0] + B.max[0]) / 2, (B.min[2] + B.max[2]) / 2], size = Math.min(B.max[0] - B.min[0], B.max[2] - B.min[2]);
const lim = [B.min[0] + 8, B.max[0] - 8, B.min[2] + 8, B.max[2] - 8];
const solid = (x, z) => sampleH(td, x, z) - sampleH(hd, x, z) > 0.8, inside = (x, z) => x > lim[0] && x < lim[1] && z > lim[2] && z < lim[3];
const clear = (x, z, r = 8) => { if (!inside(x, z)) return false; for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) if (solid(x + dx, z + dz)) return false; return true; };
const spot = (x, z, room) => { for (let r = 0; r < 90; r += 4) for (let a = 0; a < 6.28; a += 0.5) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (clear(px, pz, room)) return [px, pz, r]; if (!r) break; } return [x, z, 99]; };
const R = Math.min(size * 0.36, 150); let best = 0, bs = -1, scores = [];
for (let a = 0; a < Math.PI; a += Math.PI / 8) { let s = 0; for (const sg of [-1, 1]) for (let d = R * 0.6; d <= R; d += 6) if (clear(mid[0] + Math.sin(a) * d * sg, mid[1] + Math.cos(a) * d * sg, 6)) s++; scores.push(s); if (s > bs) { bs = s; best = a; } }
const ax = Math.sin(best), az = Math.cos(best), bases = [spot(mid[0] - ax * R, mid[1] - az * R, 6), spot(mid[0] + ax * R, mid[1] + az * R, 6)];
const off = size * 0.14, pts = [[-0.5, 1], [0, -1], [0.5, 1]].map(p => spot(mid[0] + ax * R * p[0] + az * off * p[1], mid[1] + az * R * p[0] - ax * off * p[1], 6));
const ms = spot(mid[0], mid[1], 6);
console.log(`axis scores ${scores.join(' ')} (best ${(best * 180 / Math.PI).toFixed(0)} deg); bases ${bases.map(b => `(${b[0] | 0}, ${b[1] | 0}) moved ${b[2]} m`).join(', ')}; points ${pts.map(b => `(${b[0] | 0}, ${b[1] | 0}) +${b[2]}`).join(' ')}; middle spot moved ${ms[2]} m`);
// drivable grid (as check_heights), then erode by 4.5 m (a 9 m wide route) and flood from the middle
const ok = new Uint8Array(nx * nz), maxS = Math.tan(22 * Math.PI / 180), at = (a, i, j) => a[j * nx + i];
for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) { const tall = at(td, i, j) - at(hd, i, j) > 0.8, sx = (at(hd, i + 1, j) - at(hd, i - 1, j)) / (2 * c), sz = (at(hd, i, j + 1) - at(hd, i, j - 1)) / (2 * c); if (!tall && Math.hypot(sx, sz) <= maxS) ok[j * nx + i] = 1; }
const WW = +((process.argv.find(a => a.startsWith("--w=")) || "--w=9").slice(4)), rr = Math.round(WW / 2 / c), wide = new Uint8Array(nx * nz), offs = []; for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) if (di * di + dj * dj <= rr * rr) offs.push([di, dj]);
// blocked = not ok AND inside the playable lim (edges do not count as walls for width)
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { if (!ok[j * nx + i]) continue; let w = 1; for (const [di, dj] of offs) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; if (!ok[b * nx + a]) { const x = H.x0 + a * c, z = H.z0 + b * c; if (inside(x, z)) { w = 0; break; } } } wide[j * nx + i] = w; }
const cell = (x, z) => [Math.round((x - H.x0) / c), Math.round((z - H.z0) / c)];
const seen = new Uint8Array(nx * nz); { const [i0, j0] = cell(ms[0], ms[1]); const st = [[i0, j0]]; while (st.length) { const [i, j] = st.pop(); if (i < 0 || j < 0 || i >= nx || j >= nz) continue; const k = j * nx + i; if (seen[k] || !wide[k]) continue; seen[k] = 1; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); } }
let wN = 0, sN = 0, okN = 0; for (let k = 0; k < nx * nz; k++) { okN += ok[k]; wN += wide[k]; sN += seen[k]; }
const reach = p => { const [i, j] = cell(p[0], p[1]); for (let d = 0; d < 8; d++) for (let di = -d; di <= d; di++) for (let dj = -d; dj <= d; dj++) if (seen[(j + dj) * nx + i + di]) return true; return false; };
console.log(`drivable ${(100 * okN / (nx * nz)).toFixed(1)}%; ${WW} m-wide centre-line cells ${(100 * wN / okN).toFixed(1)}% of drivable; reached by ${WW} m routes from the middle ${(100 * sN / Math.max(1, wN)).toFixed(1)}%; bases reachable ${bases.map(reach).join('/')}, points ${pts.map(reach).join('/')}`);
const pi = process.argv.indexOf('--png');
if (pi > 0) { const out = process.argv[pi + 1], W = nx, Hh = nz, px = Buffer.alloc(W * Hh * 3);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const k = j * nx + i, o = (j * W + i) * 3; const h = hd[k]; const base = clamp(90 + h * 6, 40, 200);
    if (!ok[k]) { const tall = td[k] - hd[k] > 0.8; px[o] = tall ? 200 : 120; px[o + 1] = tall ? 40 : 80; px[o + 2] = tall ? 40 : 60; } else if (seen[k]) { px[o] = base * 0.6; px[o + 1] = base; px[o + 2] = base * 0.6; } else if (wide[k]) { px[o] = base; px[o + 1] = base; px[o + 2] = 40; } else { px[o] = base; px[o + 1] = base; px[o + 2] = base; } }
  for (const p of [...bases, ...pts, ms]) { const [i, j] = cell(p[0], p[1]); for (let d = -3; d <= 3; d++) for (const [a, b] of [[i + d, j], [i, j + d]]) if (a >= 0 && b >= 0 && a < W && b < Hh) { const o = (b * W + a) * 3; px[o] = 0; px[o + 1] = 120; px[o + 2] = 255; } }
  const tmp = out + '.ppm'; fs.writeFileSync(tmp, Buffer.concat([Buffer.from(`P6 ${W} ${Hh} 255\n`), px])); execSync(`ffmpeg -loglevel error -y -i "${tmp}" "${out}"`); fs.unlinkSync(tmp); console.log('png', out); }
