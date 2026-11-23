// ============================================================
// Tanks. Every tank on the field is a copy of the one model in the terrain file (hull > turret > barrel, each with a
// lighter twin for far away): Units.make. A tank drives over the height map and leans with it, its turret and gun turn at
// their own speed toward an aim point (to the angle that drops a shell there), its shells fly in an arc and meet the
// ground, a thing standing on it, or another tank: where they strike (front, side, rear, turret) and at what angle
// decides how much they do. Units.ai drives the ones the computer owns.
// ============================================================
// slew, lift: how fast the turret turns and the gun rises (radians a second); elevMin..elevMax: how far the gun can dip and rise
// accel, brake: how fast the speed closes on what the throttle asks (per second: 1.6 = most of the way in a second)
const TD = { max: 13, rev: 6, accel: 1.6, brake: 3.2, turn: 1.7, slew: 1.9, lift: 1.0, elevMin: -0.14, elevMax: 0.42, reload: 2.6, shell: 300, camDist: 16, lodFar: 45, fov: 66, sightFov: 15, hp: 1000 };
// AP: one hard hit that armour and angle can turn; HE: less, but it does not care about angle and hurts everything near
// AC: an autocannon's small shell (armour and angle count, as for AP). HH: an artillery piece's heavy shell.
const SHELLS = { ap: { name: 'AP', full: 'ARMOUR PIERCING', dmg: 380, splash: 0 }, he: { name: 'HE', full: 'HIGH EXPLOSIVE', dmg: 190, splash: 8 }, ac: { name: 'AC', full: '30 MM AUTOCANNON', dmg: 40, splash: 0, small: true }, hh: { name: 'HE', full: 'HEAVY HIGH EXPLOSIVE', dmg: 480, splash: 15 } };
const ARMOUR = { front: 0.5, side: 1, rear: 1.6, turret: 0.8 };
// hp, speed, reload (time), dmg, guard (damage taken): multipliers on TD. shade tints the paint.
const KINDS = {
    light:  { name: 'LIGHT', model: 'light', hp: 0.75, speed: 1.3, reload: 0.75, dmg: 0.8, guard: 1, shade: 1.12, desc: 'Fast and quick to load, thin-skinned. Get behind them before they turn.' },
    medium: { name: 'MEDIUM', model: 'tank', hp: 1, speed: 1, reload: 1, dmg: 1, guard: 1, shade: 1, desc: 'The all-rounder. Enough armour to trade, enough speed to choose where.' },
    heavy:  { name: 'HEAVY', model: 'heavy', hp: 1.5, speed: 0.74, reload: 1.3, dmg: 1.35, guard: 0.9, shade: 0.8, desc: 'A slow fortress with the biggest gun. Face them, and make every shell count.' }
};
const UPGRADES = {
    armour: { name: 'APPLIQUE ARMOUR', desc: '+200 hull, and every hit does 8% less', apply: U => { U.max += 200; U.hp += 200; U.k.guard *= 0.92; } },
    engine: { name: 'TUNED ENGINE', desc: '+12% speed and pull', apply: U => { U.k.speed *= 1.12; } },
    loader: { name: 'DRILLED LOADER', desc: 'reload 12% faster', apply: U => { U.k.reload *= 0.88; } },
    gun:    { name: 'HOT CHARGES', desc: '+12% shell damage', apply: U => { U.k.dmg *= 1.12; } },
    kits:   { name: 'FIELD WORKSHOP', desc: 'two repair kits now, and the hull made whole', apply: (U, G) => { G.kits = Math.min(4, G.kits + 2); U.hp = U.max; } }
};
const Units = { list: [], shells: [], pool: [], half: [1.7, 3.3], muzzle: [0, 0, 3], nextId: 1, show: null };
// a vehicle of the research tree (lt1 ... arty5) or one of the three plain kinds
Units.def = kind => VEHS[kind] || KINDS[kind] || KINDS.medium;
const TL = new Float32Array(16), UM = new Float32Array(6);
function rotY(o, a) { const c = Math.cos(a), s = Math.sin(a); M4.ident(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
function rotX(o, a) { const c = Math.cos(a), s = Math.sin(a); M4.ident(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; }
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// once per terrain file, for each tank model in it (tank_*, light_*, heavy_*): how wide and long the hull is, how tall the
// hull and the turret stand, and where the mouth of the gun is on the barrel
// vehicles that have a file of their own (v_<id>.hgm), not a place in a terrain file: brought in once, kept for good
Units.extra = {};
Units.loadExtras = function () { return Promise.all(['td', 'spaa', 'arty', 'apc', 'truck', 'atgun', 'ftr', 'atk', 'bmb', 'heli'].map(async id => { if (Units.extra[id]) return; const f = (AIRS[id] ? 'a_' : 'v_') + id + '.hgm'; try { const r = await fetch(AST(f), { method: 'HEAD' }); if (r.ok) Units.extra[id] = await HG3D.load(AST(f), { anisotropy: 2 }); } catch (e) { } })); };
Units.setup = function (A0) {
    Units.models = {};
    for (const pre of ['tank', 'light', 'heavy', 'td', 'spaa', 'arty', 'apc', 'ftr', 'atk', 'bmb', 'heli']) {
        const A = A0.objects[pre + '_hull'] ? A0 : Units.extra[pre]; if (!A) continue;
        const h = A.objects[pre + '_hull'], t = A.objects[pre + '_turret'], b = A.objects[pre + '_barrel']; if (!h) continue; const M = { A, half: [1.7, 3.3], muzzle: [0, 0, 3], hullTop: 1.75, turTop: 2.75, turHalf: [1.35, 1.7] };
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = -1e9, yl = 1e9; for (const p of h.info.prims) { yl = Math.min(yl, p.min[1]); x0 = Math.min(x0, p.min[0]); x1 = Math.max(x1, p.max[0]); z0 = Math.min(z0, p.min[2]); z1 = Math.max(z1, p.max[2]); y1 = Math.max(y1, p.max[1]); }
        if (x1 > x0) { M.half = [(x1 - x0) / 2, (z1 - z0) / 2]; M.hullTop = y1; M.yLo = yl; }
        if (t && t.info.prims.length) { let tx = 0, tz = 0, ty0 = 1e9, ty1 = -1e9; for (const p of t.info.prims) { tx = Math.max(tx, Math.abs(p.min[0]), Math.abs(p.max[0])); tz = Math.max(tz, Math.abs(p.min[2]), Math.abs(p.max[2])); ty0 = Math.min(ty0, p.min[1]); ty1 = Math.max(ty1, p.max[1]); } M.turHalf = [tx + 0.1, Math.min(tz, M.half[1]) + 0.1]; M.turTop = M.hullTop + (ty1 - ty0) + 0.1; }
        if (b) { let zMax = -1e9, sx = 0, sy = 0, n = 0; const ms = b.children.filter(c => c.isMesh);
            for (const m of ms) { const p = m.geometry.attributes.position.array; for (let i = 2; i < p.length; i += 3) if (p[i] > zMax) zMax = p[i]; }
            for (const m of ms) { const p = m.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) if (p[i + 2] > zMax - 0.05) { sx += p[i]; sy += p[i + 1]; n++; } }
            if (n) M.muzzle = [sx / n, sy / n, zMax]; }
        Units.models[pre] = M;
    }
};
// a tank for a side (0 = the player's olive, 1 = the enemy's sand). Wrecks that have burnt out are used again.
Units.make = function (team, x, z, yaw, kind, mods) {
    // its own model when the terrain file has one for this kind, else the medium's with a shade
    const KD = Units.def(kind), own = !!Units.models[KD.model], pre = own ? KD.model : (KD.alt && Units.models[KD.alt] ? KD.alt : 'tank'), MD = Units.models[pre]; if (!MD) throw new Error('the terrain file has no tank in it');
    let U = null; for (let i = 0; i < Units.pool.length; i++) if (Units.pool[i].team === team && Units.pool[i].pre === pre) { U = Units.pool.splice(i, 1)[0]; break; }
    if (!U) {
        const root = MD.A.copy(pre + '_hull');
        U = { root, pre, turret: root.find(pre + '_turret'), barrel: root.find(pre + '_barrel'), mats: root.materials, team, up: [0, 1, 0], light: new Float32Array(4), TM: new Float32Array(16), half: MD.half, muzzle: MD.muzzle, hullTop: MD.hullTop, turTop: MD.turTop, turHalf: MD.turHalf };
        U.parts = ['_hull', '_turret', '_barrel'].map(n => { const node = root.find(pre + n); return node ? { node, full: node.children.filter(c => c.isMesh), lod: root.find(pre + n + '_lod1') } : null; }).filter(Boolean);
        const t = team ? [1.25, 1.02, 0.72] : (Units.models.light ? [0.7, 0.84, 0.5] : [1, 1, 1]); U.paint = U.mats.map(m => { const g = /_gear$/.test(m.name || ''); return [m.color.r * (g ? 1 : t[0]), m.color.g * (g ? 1 : t[1]), m.color.b * (g ? 1 : t[2]), g]; });
    }
    const K = KD; U.kind = VEHS[kind] || KINDS[kind] ? kind : 'medium'; U.def = K; U.shells = K.shells || ['ap', 'he'];
    U.k = { hp: K.hp, speed: K.speed, reload: K.reload, dmg: K.dmg, guard: K.guard, slew: 1, shellV: K.shellV || TD.shell, arc: K.arc || 0, elevMax: K.elevMax || TD.elevMax, auto: !!K.auto, fly: K.fly || 0, turn: K.turn || 0 }; if (mods) for (const m in mods) if (MODS[m] && mods[m]) MODS[m].apply(U.k, mods[m]);
    const shade = own ? (VEHS[kind] ? K.shade : 1) : K.shade; U.mats.forEach((m, i) => { const k = U.paint[i][3] ? 1 : shade; m.color.r = U.paint[i][0] * k; m.color.g = U.paint[i][1] * k; m.color.b = U.paint[i][2] * k; });
    World.scene.add(U.root); U.root.visible = true;
    Object.assign(U, { id: Units.nextId++, x, z, y: World.height(x, z), yaw: yaw || 0, v: 0, tyaw: 0, elev: 0.03, hp: TD.hp * U.k.hp, max: TD.hp * U.k.hp, reload: 1 + Math.random(), recoil: 0, rock: 0, dead: false, deadT: 0, dustT: 0, laid: false, stop: false, shellType: U.shells[0], ai: null, hitT: 0, who: null, counted: false, remote: false, tx: undefined });
    U.up[0] = 0; U.up[1] = 1; U.up[2] = 0; U.air = false; U.heli = false;
    if (K.air && own) Air.init(U); else { U.half = MD.half; U.hullTop = MD.hullTop; U.turTop = MD.turTop; U.muzzle = MD.muzzle; U.yLo = 0.2; }
    Units.list.push(U); Units.place(U); return U;
};
Units.retire = function (U) { const i = Units.list.indexOf(U); if (i >= 0) Units.list.splice(i, 1); World.scene.remove(U.root); Units.pool.push(U); };
Units.clear = function () { for (const U of Units.list.slice()) Units.retire(U); Units.shells.length = 0; Units.show = null; };
// leaving a terrain: every copy made from its tank models goes with it
Units.forget = function () { Units.clear(); for (const U of Units.pool) R.release(U.root); Units.pool.length = 0; Units.models = {}; };
// the tank's matrices from where it is and how the ground leans
Units.place = function (U) {
    if (U.air) return Air.place(U);
    const u = U.up, fx0 = Math.sin(U.yaw), fz0 = Math.cos(U.yaw), TM = U.TM;
    let d = fx0 * u[0] + fz0 * u[2], zx = fx0 - u[0] * d, zy = -u[1] * d, zz = fz0 - u[2] * d, l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    const rk = U.rock * 0.03; zy += rk; l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    const k = u[0] * zx + u[1] * zy + u[2] * zz; let yx = u[0] - zx * k, yy = u[1] - zy * k, yz = u[2] - zz * k; l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l;
    const xx = yy * zz - yz * zy, xy = yz * zx - yx * zz, xz = yx * zy - yy * zx;
    TM[0] = xx; TM[1] = xy; TM[2] = xz; TM[3] = 0; TM[4] = yx; TM[5] = yy; TM[6] = yz; TM[7] = 0; TM[8] = zx; TM[9] = zy; TM[10] = zz; TM[11] = 0; TM[12] = U.x; TM[13] = U.y; TM[14] = U.z; TM[15] = 1;
    if (U.turret) M4.mul(U.turret.local, U.turret.rest, rotY(TL, U.tyaw));
    if (U.barrel) { M4.mul(U.barrel.local, U.barrel.rest, rotX(TL, -U.elev)); const b = U.barrel.local, r = U.recoil * U.recoil * 0.45; b[12] -= b[8] * r; b[13] -= b[9] * r; b[14] -= b[10] * r; }
    HG3D.place(U.root, TM);
};
// drive: thr -1..1, steer -1..1 (left is positive). The ground's slope speeds it up and slows it down; solid things stop it.
Units.drive = function (U, thr, steer, dt) {
    const fx = Math.sin(U.yaw), fz = Math.cos(U.yaw), hx = U.half[0], hz = U.half[1];
    const slope = (World.height(U.x + fx * hz, U.z + fz * hz) - World.height(U.x - fx * hz, U.z - fz * hz)) / (2 * hz);
    /* the speed eases onto what the throttle asks (quickly: it is off the line in a moment, and it stops when you let go); the hull turns on the spot */
    const ks = U.k.speed, top = TD.max * ks * clamp(1 - slope * 0.9, 0.35, 1.15), tk = Math.min(1, Math.abs(thr) * 1.34), tv = thr > 0 ? top * tk : thr < 0 ? -TD.rev * ks * tk : 0, same = tv !== 0 && tv * U.v >= 0;
    U.v += (tv - U.v) * Math.min(1, dt * (same ? TD.accel : TD.brake)); U.v -= slope * 6 * dt; U.v = clamp(U.v, -TD.rev * ks, top); if (!thr && Math.abs(U.v) < 0.15 && Math.abs(slope) < 0.08) U.v = 0;
    U.yaw += steer * TD.turn * dt * (0.6 + 0.4 * (1 - Math.abs(U.v) / TD.max)) * (U.v < -0.5 ? -1 : 1);
    const nx = U.x + fx * U.v * dt, nz = U.z + fz * U.v * dt, lead = (U.v >= 0 ? 1 : -1) * (hz + 0.4);
    /* what the leading edge would be in at a place: 1 the middle, 2 the corner on the side the hull turns to with yaw, 4 the other corner, 8 off the ground */
    const hitAt = (x, z) => { const cx = x + fx * lead, cz = z + fz * lead; return (World.solid(cx, cz) ? 1 : 0) | (World.solid(cx + fz * hx, cz - fx * hx) ? 2 : 0) | (World.solid(cx - fz * hx, cz + fx * hx) ? 4 : 0) | (World.inside(x, z) ? 0 : 8); };
    let mx = nx, mz = nz, h = hitAt(nx, nz), stop = h !== 0;
    if (h === 2 || h === 4) { U.yaw += (h === 2 ? -1 : 1) * (U.v >= 0 ? 1 : -1) * 1.3 * dt; U.v *= Math.max(0, 1 - 1.6 * dt); mx = U.x + fx * U.v * dt * 0.6; mz = U.z + fz * U.v * dt * 0.6; stop = false; }          /* one corner only: it glances off, swinging away and losing a little speed */
    else if (h) { if (!hitAt(nx, U.z)) { mz = U.z; stop = false; } else if (!hitAt(U.x, nz)) { mx = U.x; stop = false; } if (!stop) U.v *= Math.max(0, 1 - 2.5 * dt); }          /* head on: it slides along if there is a way along */
    if (!stop) for (const O of Units.list) if (O !== U && Math.hypot(O.x - nx, O.z - nz) < hz * 1.5 && (O.x - U.x) * fx * U.v + (O.z - U.z) * fz * U.v > 0) { stop = true; break; }      // not through another tank
    if (stop) U.v *= -0.15; else { U.x = mx; U.z = mz; }
    U.blocked = stop || (h !== 0 && Math.abs(U.v) < 0.5);
    // sitting on the ground: the height under four points gives the lean
    const hf = World.height(U.x + fx * hz, U.z + fz * hz), hb = World.height(U.x - fx * hz, U.z - fz * hz), hl = World.height(U.x + fz * hx, U.z - fx * hx), hr = World.height(U.x - fz * hx, U.z + fx * hx);
    const ty = (hf + hb + hl + hr) / 4, k = Math.min(1, dt * 8); U.y = lerp(U.y, ty, Math.min(1, dt * 12));
    const ux = -(hl - hr) / (2 * hx) * fz - (hf - hb) / (2 * hz) * fx, uz = (hl - hr) / (2 * hx) * fx - (hf - hb) / (2 * hz) * fz, ul = Math.hypot(ux, 1, uz);
    U.up[0] = lerp(U.up[0], ux / ul, k); U.up[1] = lerp(U.up[1], 1 / ul, k); U.up[2] = lerp(U.up[2], uz / ul, k);
    // dust behind the tracks
    U.dustT -= dt * Math.abs(U.v);
    if (U.dustT <= 0 && Math.abs(U.v) > 1.5) { U.dustT = 0.9; const d = World.dustC, sgn = U.v > 0 ? -1 : 1; for (const sd of [-1, 1]) World.smoke.add(U.x + fx * sgn * hz + fz * sd * hx * 0.8, U.y + 0.4, U.z + fz * sgn * hz - fx * sd * hx * 0.8, 0, 0.7, 0, 1.4, 1.8, 1.6, d[0] * 0.75, d[1] * 0.68, d[2] * 0.58, 0.4); }
};
// turn the turret and lift the gun toward a point. arc = aim to DROP a shell there (else point straight at it)
Units.lay = function (U, ax, ay, az, arc, dt) {
    const dx = ax - U.x, dz = az - U.z, dist = Math.hypot(dx, dz) || 1, h = ay - (U.y + 2.3), v2 = U.k.shellV * U.k.shellV, g = 9.8, TM = U.TM, eMax = U.k.elevMax;
    let th = Math.atan2(h, dist);
    if (arc && dist > 8) { const disc = v2 * v2 - g * (g * dist * dist + 2 * h * v2); th = disc > 0 ? Math.atan2(v2 - Math.sqrt(disc), g * dist) : 0.6; }
    U.range = Math.hypot(dist, h);
    const c = Math.cos(th), wx = dx / dist * c, wy = Math.sin(th), wz = dz / dist * c;
    // into the hull's own space, which leans with the ground: the gun stays on its mark while the tank rocks and climbs
    const lx = wx * TM[0] + wy * TM[1] + wz * TM[2], ly = wx * TM[4] + wy * TM[5] + wz * TM[6], lz = wx * TM[8] + wy * TM[9] + wz * TM[10];
    const want = Math.atan2(lx, lz), turn = wrapA(want - U.tyaw), wantEl = Math.atan2(ly, Math.hypot(lx, lz)), rise = clamp(wantEl, TD.elevMin, eMax) - U.elev, sl = TD.slew * U.k.slew * dt, lf = TD.lift * U.k.slew * dt;
    U.tyaw += clamp(turn, -sl, sl); U.elev += clamp(rise, -lf, lf);
    let out = false; if (U.k.arc) { const a = wrapA(U.tyaw); U.tyaw = clamp(a, -U.k.arc, U.k.arc); out = Math.abs(wrapA(want)) > U.k.arc + 0.01; }          // a gun in the hull: past its arc the hull has to turn
    U.stop = out || wantEl < TD.elevMin - 0.004 || wantEl > eMax + 0.004;         // the gun cannot dip, rise or swing that far
    U.laid = !U.stop && Math.abs(turn) < 0.012 && Math.abs(rise) < 0.012;
};
// the mouth of the gun and the way it points: out = [x, y, z, dx, dy, dz]
Units.muzzleOf = function (U, o) {
    const b = U.barrel ? U.barrel.matrixWorld.elements : U.TM, m = U.muzzle, l = Math.hypot(b[8], b[9], b[10]) || 1;
    o[0] = b[0] * m[0] + b[4] * m[1] + b[8] * m[2] + b[12]; o[1] = b[1] * m[0] + b[5] * m[1] + b[9] * m[2] + b[13]; o[2] = b[2] * m[0] + b[6] * m[1] + b[10] * m[2] + b[14]; o[3] = b[8] / l; o[4] = b[9] / l; o[5] = b[10] / l; return o;
};
// where a shell fired this instant would come down: out = [x, y, z]
Units.fall = function (U, out) {
    /* steps of three metres at most whatever the shell's speed, and the last step is searched for the place it meets the ground: the ring is where the shell lands */
    const m = Units.muzzleOf(U, UM), sv = U.k.shellV, h = Math.min(0.03, 3 / sv), n = Math.ceil(14 / h); let x = m[0], y = m[1], z = m[2], vx = m[3] * sv, vy = m[4] * sv, vz = m[5] * sv, px = x, py = y, pz = z;
    for (let i = 0; i < n; i++) { px = x; py = y; pz = z; vy -= 9.8 * h; x += vx * h; y += vy * h; z += vz * h; if (y <= World.top(x, z)) { let b = 1, a = 0; for (let k = 0; k < 5; k++) { const t = (a + b) / 2; if (lerp(py, y, t) <= World.top(lerp(px, x, t), lerp(pz, z, t))) b = t; else a = t; } x = lerp(px, x, b); y = lerp(py, y, b); z = lerp(pz, z, b); break; } let hitU = false; for (const O of Units.list) if (O !== U && !O.dead && Math.hypot(O.x - x, O.z - z) < 2.4 && y < O.y + 2.7 && y > O.y) { hitU = true; break; } if (hitU) break; }
    out[0] = x; out[1] = y; out[2] = z; return out;
};
Units.fire = function (U, G) {
    const m = Units.muzzleOf(U, UM), sv = U.k.shellV, type = U.shellType || 'ap', small = !!SHELLS[type].small; U.reload = TD.reload * U.k.reload * (U.ai ? U.ai.reloadK : 1); U.recoil = small ? 0.35 : 1; U.rock = Math.max(U.rock, small ? 0.15 : 1);
    const jx = small ? rand(-0.006, 0.006) : 0, jy = small ? rand(-0.006, 0.006) : 0;
    Units.shells.push({ x: m[0], y: m[1], z: m[2], vx: (m[3] + jx) * sv, vy: (m[4] + jy) * sv, vz: (m[5] - jx) * sv, t: 0, by: U, type, k: U.k.dmg }); Net.fired(U, Units.shells[Units.shells.length - 1]);
    if (small) { World.fire.add(m[0], m[1], m[2], 0, 0.5, 0, 0.9, 3, 0.08, 1, 0.9, 0.6, 1); G.heard(m[0], m[2], 0.3, 420, 0.12); } else { World.boom(m[0], m[1] - 0.5, m[2], false); G.heard(m[0], m[2], 0.7, 220, 0.5); }
};
// which plate a shell met, and how squarely: tank U, shell at (x, y, z) flying along (dx, dy, dz)
Units.strike = function (U, x, y, z, dx, dy, dz) {
    if (U.air) return { part: 'side', square: 1 };          // nothing on an aircraft turns a shell
    // the plate is the face of the hull the shell is at; how squarely = how much of its flight goes straight into that face
    const T = U.TM, rx = x - U.x, ry = y - U.y, rz = z - U.z, lx = rx * T[0] + ry * T[1] + rz * T[2], ly = rx * T[4] + ry * T[5] + rz * T[6], lz = rx * T[8] + ry * T[9] + rz * T[10], ldx = dx * T[0] + dy * T[1] + dz * T[2], ldz = dx * T[8] + dy * T[9] + dz * T[10];
    if (ly > U.hullTop) return { part: 'turret', square: 0.8 };
    if (Math.abs(lz) / U.half[1] >= Math.abs(lx) / U.half[0]) return { part: lz > 0 ? 'front' : 'rear', square: Math.abs(ldz) };
    return { part: 'side', square: Math.abs(ldx) };
};
Units.damage = function (U, dmg, by, G, word) {
    if (U.safeT > 0 && by && by !== U && dmg < 5000) return;          // just deployed
    if (U.dead) return; if (G.net && !G.net.host) return Net.guestDamage(U, dmg, by, word);
    dmg *= U.k.guard; U.hp -= dmg; U.hitT = 0.3; U.rock = Math.max(U.rock, 0.6);
    if (U.hp <= 0) { U.hp = 0; U.dead = true; U.deadT = 0; U.v = 0; World.boom(U.x, U.y + 1.5, U.z, true); World.boom(U.x, U.y + 2.2, U.z, true); G.heard(U.x, U.z, 1, 70, 1.2); U.tyaw += rand(-0.6, 0.6); U.elev = TD.elevMin; }
    G.struck(U, dmg, by, word);
};
// shells: fall, meet a tank, the ground, or something on it
Units.step = function (dt, G) {
    const S = Units.shells;
    for (let i = S.length - 1; i >= 0; i--) {
        const s = S[i]; let gone = false;
        for (let step = 0; step < 6 && !gone; step++) {
            const h = dt / 6; s.vy -= 9.8 * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.t += h;
            for (const U of Units.list) {
                if (U === s.by || U.dead || (s.by && U.team === s.by.team && !Game.ff)) continue; const T = U.TM, rx = s.x - U.x, ry = s.y - U.y, rz = s.z - U.z; if (rx * rx + rz * rz > (U.air ? 260 : 25)) continue;
                const lx = rx * T[0] + ry * T[1] + rz * T[2], ly = rx * T[4] + ry * T[5] + rz * T[6], lz = rx * T[8] + ry * T[9] + rz * T[10];
                if (!((Math.abs(lx) < U.half[0] + 0.1 && Math.abs(lz) < U.half[1] + 0.1 && ly > U.yLo && ly < U.hullTop) || (Math.abs(lx) < U.turHalf[0] && Math.abs(lz) < U.turHalf[1] && ly >= U.hullTop && ly < U.turTop))) continue;
                const sp = Math.hypot(s.vx, s.vy, s.vz), k = Units.strike(U, s.x, s.y, s.z, s.vx / sp, s.vy / sp, s.vz / sp), SH = SHELLS[s.type]; gone = true; if (s.cos) { World.boom(s.x, s.y, s.z, !SH.small); break; }          // someone else's shell: seen, not counted here
                const hard = s.type === 'ap' || s.type === 'ac';
                if (hard && k.square < 0.34) { World.fire.add(s.x, s.y, s.z, 0, 3, 0, 1.5, 4, 0.12, 1, 1, 1, 1); G.heard(s.x, s.z, 0.4, 900, 0.25); G.struck(U, 0, s.by, 'RICOCHET'); }
                else { const dmg = (s.k || 1) * (hard ? SH.dmg * ARMOUR[k.part] * (0.6 + 0.6 * k.square) : SH.dmg * (k.part === 'rear' ? 1.3 : 1)); World.boom(s.x, s.y, s.z, !SH.small); G.heard(s.x, s.z, 0.8, 110, 0.7); Units.damage(U, dmg, s.by, G, k.part === 'rear' ? 'REAR HIT' : k.part === 'side' ? 'SIDE HIT' : k.part === 'turret' ? 'TURRET HIT' : 'FRONT HIT'); if (SH.splash) Units.blast(s.x, s.y, s.z, SH, s.by, G, U); }
                break;
            }
            if (gone) break;
            if (s.y <= World.top(s.x, s.z)) { const gy = Math.max(s.y, World.height(s.x, s.z)); World.boom(s.x, gy, s.z, !SHELLS[s.type].small); G.heard(s.x, s.z, SHELLS[s.type].small ? 0.25 : 0.7, 90, SHELLS[s.type].small ? 0.3 : 0.9); G.landed(s); if (SHELLS[s.type].splash && !s.cos) Units.blast(s.x, gy, s.z, SHELLS[s.type], s.by, G, null); gone = true; }
            else if (s.t > 20) gone = true;
        }
        if (gone) { S[i] = S[S.length - 1]; S.pop(); }
    }
    for (const U of Units.list) { U.reload = Math.max(0, U.reload - dt); U.recoil = Math.max(0, U.recoil - dt * 2.2); U.rock = lerp(U.rock, 0, Math.min(1, dt * 3)); U.hitT = Math.max(0, U.hitT - dt);
        if (U.dead) { U.deadT += dt; if (Math.random() < dt * 9 && U.deadT < 22) World.smoke.add(U.x + rand(-0.8, 0.8), U.y + 2.2, U.z + rand(-0.8, 0.8), rand(-0.4, 0.4) + 0.6, rand(1.8, 3.2), rand(-0.4, 0.4), 1.2, 2.2, rand(2, 3.5), 0.1, 0.1, 0.1, 0.8); if (Math.random() < dt * 5 && U.deadT < 12) World.fire.add(U.x + rand(-0.7, 0.7), U.y + 1.8, U.z + rand(-0.7, 0.7), 0, 1.5, 0, 1.2, 1.5, 0.4, 1, 0.8, 0.5, 0.9); } }
};
// an explosion's reach: everything near takes part of it (not the tank it struck directly)
Units.blast = function (x, y, z, SH, by, G, direct) { for (const U of Units.list) { if (U === direct || U.dead || U === by || (by && U.team === by.team)) continue; const d = Math.hypot(U.x - x, U.y + 1.2 - y, U.z - z); if (d < SH.splash) Units.damage(U, SH.dmg * 0.6 * (1 - d / SH.splash), by, G, 'BLAST'); } };

// ---- the ones the computer drives: close to a range they like, circle there, lay on the player with a lead and an error
Units.brain = function (U, skill) { const b = U.def && U.def.br, lo = b === 'arty' ? 120 : b === 'td' ? 85 : b === 'spaa' || b === 'lt' ? 40 : 50, hi = b === 'arty' ? 175 : b === 'td' ? 125 : b === 'spaa' || b === 'lt' ? 70 : 95; U.ai = { range: rand(lo, hi), side: Math.random() < 0.5 ? 1 : -1, errT: 0, ex: 0, ez: 0, wait: rand(0.6, 1.6), skill, reloadK: U.k.auto ? 1 : lerp(1.5, 1.05, skill), unstick: 0, tgt: null, tgtT: 0 }; };
Units.ai = function (U, dt, G) {
    const A = U.ai; if (U.dead) return; let thr = 0, steer = 0, head = null, slow = false;
    const P = G.targetFor ? G.targetFor(U) : G.P, goal = G.goalFor ? G.goalFor(U) : null, fx = Math.sin(U.yaw), fz = Math.cos(U.yaw), la = U.half[1] + 5;
    let dist = 1e9;
    if (P && !P.dead) {
        const dx = P.x - U.x, dz = P.z - U.z, bear = Math.atan2(dx, dz); dist = Math.hypot(dx, dz);
        // where to head: toward the target when far, away when too close, round it at the range this one likes
        head = dist > A.range + 12 ? bear : dist < A.range - 18 ? bear + Math.PI * 0.75 * A.side : bear + Math.PI * 0.5 * A.side;
        if (U.k.arc && dist < A.range + 30) { head = bear; slow = true; }          // a gun in the hull: face them and sit
        else if (A.skill > 0.3 && !U.air) {
            A.losT = (A.losT || 0) - dt; if (A.losT <= 0) { A.losT = 0.4 + Math.random() * 0.2; A.los = World.los(U.x, U.y + 2.2, U.z, P.x, P.y + 1.8, P.z); }
            const Bs = G.base && G.base[U.team];
            if (U.hp < U.max * 0.3 && Bs && dist < A.range + 40 && Math.hypot(Bs[0] - U.x, Bs[1] - U.z) > 30) { head = Math.atan2(Bs[0] - U.x, Bs[1] - U.z); A.cover = null; }
            else if (A.cover) { const cd = Math.hypot(A.cover[0] - U.x, A.cover[1] - U.z); if (U.reload < 0.6 || A.coverT < G.time) A.cover = null; else if (cd < 3.5) head = null; else head = Math.atan2(A.cover[0] - U.x, A.cover[1] - U.z); }
            else if (A.los === false && dist < A.range + 12) head = bear;
        }
        // the gun: the target's place, a lead for the shell's flight, and an error that is drawn again now and then
        A.errT -= dt; if (A.errT <= 0) { A.errT = rand(1.2, 2.4); const e = dist * lerp(0.07, 0.018, A.skill); A.ex = rand(-e, e); A.ez = rand(-e, e); }
        const tof = dist / U.k.shellV * (U.k.shellV < 150 ? 1.6 : 1), pv = P.v || 0, ax = P.x + Math.sin(P.yaw) * pv * tof + A.ex, az = P.z + Math.cos(P.yaw) * pv * tof + A.ez;
        Units.lay(U, ax, P.y + 1.3, az, true, dt);
        if (U.laid && U.reload <= 0 && dist < 420) { A.wait -= dt; if (A.wait <= 0) { const m = Units.muzzleOf(U, UM); if (U.k.shellV < 150 || World.los(m[0], m[1], m[2], P.x, P.y + 1.8, P.z)) { U.shellType = U.shells.length > 1 && Math.random() < 0.25 ? U.shells[1] : U.shells[0]; Units.fire(U, G); if (A.skill > 0.35 && !U.k.auto && !U.k.arc && !U.air && Math.random() < A.skill) { A.cover = Game.coverFor(U, P); A.coverT = G.time + 7; } } A.wait = U.k.auto ? 0 : rand(0.3, 1.2); } }
    }
    if (goal) { const gd = Math.hypot(goal[0] - U.x, goal[1] - U.z); if (gd > 8 && dist > A.range + 20) head = Math.atan2(goal[0] - U.x, goal[1] - U.z); else if (gd <= 8 && dist > A.range) { head = null; } }
    if (A.unstick > 0) { A.unstick -= dt; thr = -0.8; steer = A.side; }
    else if (head !== null) { if (World.solid(U.x + fx * la, U.z + fz * la) || !World.inside(U.x + fx * (la + 6), U.z + fz * (la + 6))) head = U.yaw + 1.2 * A.side; if (U.blocked && Math.abs(U.v) < 0.5) { A.unstick = 1.4; A.side = -A.side; }
        const d = wrapA(head - U.yaw); steer = clamp(d * 1.6, -1, 1); thr = slow ? (Math.abs(d) > 0.15 ? 0.25 : 0) : Math.abs(d) > 1.6 ? 0.3 : 0.75; }
    Units.drive(U, thr, steer, dt);
};
// draw: the lighter model when far from the camera, lit by the baked light where it stands; a burnt wreck is dark
Units.render = function (cx, cy, cz) {
    const A = World.A, sh = World.shadows, s = sh.instanceMatrix.array; let n = 0;
    for (const U of Units.list) {
        Units.place(U); const far = Math.hypot(U.x - cx, U.y - cy, U.z - cz) > TD.lodFar; for (const p of U.parts) { if (!p.lod) continue; for (const m of p.full) m.visible = !far; p.lod.visible = far; }
        A.probe(U.x, U.z, U.light); const L = U.light, k = U.dead ? 0.22 : 1 + U.hitT * 2; for (const m of U.mats) { m.probe[0] = L[0] * k; m.probe[1] = L[1] * k; m.probe[2] = L[2] * k; m.probe[3] = L[3] * (U.dead ? 0.3 : 1); }
        if (!U.air && n < 12) { const T = U.TM, o = n++ * 16, w = U.half[0] * 2 * 1.75 + Math.abs(World.shOff[0] * T[10] - World.shOff[1] * T[8]), len = U.half[1] * 2 * 1.55 + Math.abs(World.shOff[0] * T[8] + World.shOff[1] * T[10]), ox = World.shOff[0], oz = World.shOff[1], oy = -(T[4] * ox + T[6] * oz) / (T[5] || 1);
            s[o] = T[0] * w; s[o + 1] = T[1] * w; s[o + 2] = T[2] * w; s[o + 3] = 0; s[o + 4] = T[4]; s[o + 5] = T[5]; s[o + 6] = T[6]; s[o + 7] = 0; s[o + 8] = T[8] * len; s[o + 9] = T[9] * len; s[o + 10] = T[10] * len; s[o + 11] = 0; s[o + 12] = U.x + ox + T[4] * 0.08; s[o + 13] = U.y + oy + T[5] * 0.08; s[o + 14] = U.z + oz + T[6] * 0.08; s[o + 15] = 1; }
    }
    sh.count = n; if (n) sh.instanceMatrix.needsUpdate = true;
};
// behind the menu: one tank doing slow rounds of the middle
Units.showcase = function (dt, parked) {
    let U = Units.show; const veh = UI.tab === 'research' && VEHS[UI.rsel] && !$('menu').classList.contains('hidden') ? UI.rsel : Save.data.veh; if (U && U.kind !== veh && Units.list.indexOf(U) >= 0) { Units.retire(U); U = null; }
    if (!U || Units.list.indexOf(U) < 0) { const old = Units.show; const s = old ? [old.x, old.z] : Game.spot(World.mid[0] + 18, World.mid[1], 10); U = Units.show = Units.make(0, s[0], s[1], old ? old.yaw : 0.6, veh, Save.data.mods[veh]); }
    if (parked || U.air) { if (U.air) { U.y = World.height(U.x, U.z) + (U.heli ? 2.8 : 2.4); U.pitch = 0; U.roll = 0; U.v = 0; } else { Units.drive(U, 0, 0, dt); U.tyaw = Math.sin(App.time * 0.35) * 0.5; U.elev = 0.05 + Math.sin(App.time * 0.23) * 0.05; } U.reload = 1; const c = World.camera.matrixWorld.elements; return Units.render(c[12], c[13], c[14]); }
    const ang = Math.atan2(U.x - World.mid[0], U.z - World.mid[1]), rad = Math.hypot(U.x - World.mid[0], U.z - World.mid[1]), want = ang + Math.PI / 2 + clamp((rad - 22) * 0.05, -0.8, 0.8);
    Units.drive(U, 0.6, clamp(wrapA(want - U.yaw) * 2, -1, 1), dt); U.tyaw += dt * 0.25; U.reload = 1;
    const c = World.camera.matrixWorld.elements; Units.render(c[12], c[13], c[14]);
};
