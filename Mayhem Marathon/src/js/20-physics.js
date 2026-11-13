// ============================================================
// PHYSICS: our own tiny engine. Colliders are boxes, vertical cylinders and spheres, each with an
// optional mover mv(t, c) that is a PURE function of round time (so every machine agrees on where the
// obstacles are). A Tumbler is a capsule made of two spheres. Fixed timestep 1/60 s.
// ============================================================
const STEP = 1 / 60;
const PR = 0.45, PH = 0.55;                 // Tumbler sphere radius; the upper sphere sits PH above the lower one
const K_BOX = 0, K_CYL = 1, K_SPH = 2;
const ST_RUN = 0, ST_DIVE = 1, ST_SLIDE = 2, ST_TUMBLE = 3, ST_GETUP = 4;
const GRAV = 28, RUN = 7, JUMP = 10.2, DIVE_H = 11.5, DIVE_V = 5;
const W = { cs: [], movers: [], t: 0, dt: STEP };

function mkCol(k, x, y, z, a, b, c, o) {
    o = o || {};
    const col = { k, hx: a, hy: b, hz: c, r: a, p: [x, y, z], m: [1, 0, 0, 0, 1, 0, 0, 0, 1], pp: null, pm: null, on: true,
        solid: o.solid !== false, fx: o.fx || null, mv: o.mv || null, col: o.col == null ? 0xdddddd : o.col, tag: o.tag || '', vis: o.vis !== false, rot: [o.rx || 0, o.ry || 0, o.rz || 0], data: o.data };
    if (o.rx || o.ry || o.rz) setRot(col, o.rx || 0, o.ry || 0, o.rz || 0);
    colBound(col);
    return col;
}
function colBound(c) { c.br = c.k === K_BOX ? Math.sqrt(c.hx * c.hx + c.hy * c.hy + c.hz * c.hz) : c.k === K_CYL ? Math.sqrt(c.r * c.r + c.hy * c.hy) : c.r; }
// rotation matrix (row major, world = m * local) for Euler order YXZ, same as THREE's 'YXZ'
function setRot(c, rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz), m = c.m;
    m[0] = cy * cz + sy * sx * sz; m[1] = -cy * sz + sy * sx * cz; m[2] = sy * cx;
    m[3] = cx * sz; m[4] = cx * cz; m[5] = -sx;
    m[6] = -sy * cz + cy * sx * sz; m[7] = sy * sz + cy * sx * cz; m[8] = cy * cx;
    c.rot[0] = rx; c.rot[1] = ry; c.rot[2] = rz;
}
// place c so that its local point (ox,oy,oz) hangs from a pivot: hammers, swings
function setPivot(c, px, py, pz, ox, oy, oz, rx, ry, rz) {
    setRot(c, rx, ry, rz); const m = c.m;
    c.p[0] = px + m[0] * ox + m[1] * oy + m[2] * oz; c.p[1] = py + m[3] * ox + m[4] * oy + m[5] * oz; c.p[2] = pz + m[6] * ox + m[7] * oy + m[8] * oz;
}
function worldReset() { W.cs = []; W.movers = []; W.t = 0; }
function worldAdd(c) {
    c.id = W.cs.length; W.cs.push(c);
    if (c.mv) { W.movers.push(c); c.mv(W.t, c); c.pp = c.p.slice(); c.pm = c.m.slice(); }
    return c;
}
function worldUpdate(t, dt) {
    for (const c of W.movers) {
        const pp = c.pp, pm = c.pm, p = c.p, m = c.m;
        pp[0] = p[0]; pp[1] = p[1]; pp[2] = p[2]; for (let i = 0; i < 9; i++) pm[i] = m[i];
        c.mv(t, c);
    }
    W.t = t; W.dt = dt > 0 ? dt : STEP;
}
// where would collider c be at time t? (bots look ahead with this)
function predictCol(c, t) { const o = Object.assign({}, c, { p: c.p.slice(), m: c.m.slice(), rot: c.rot.slice() }); c.mv && c.mv(t, o); return o; }

// sphere (x,y,z,r) against collider c -> HIT (normal pointing out of c, depth, contact point)
const HIT = { nx: 0, ny: 0, nz: 0, d: 0, px: 0, py: 0, pz: 0 };
function sphCol(c, x, y, z, r) {
    const dx = x - c.p[0], dy = y - c.p[1], dz = z - c.p[2], rr = c.br + r;
    if (dx * dx + dy * dy + dz * dz > rr * rr) return false;
    if (c.k === K_SPH) {
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d >= c.r + r) return false;
        if (d > 1e-6) { HIT.nx = dx / d; HIT.ny = dy / d; HIT.nz = dz / d; } else { HIT.nx = 0; HIT.ny = 1; HIT.nz = 0; }
        HIT.d = c.r + r - d; HIT.px = c.p[0] + HIT.nx * c.r; HIT.py = c.p[1] + HIT.ny * c.r; HIT.pz = c.p[2] + HIT.nz * c.r;
        return true;
    }
    const m = c.m;
    const lx = m[0] * dx + m[3] * dy + m[6] * dz, ly = m[1] * dx + m[4] * dy + m[7] * dz, lz = m[2] * dx + m[5] * dy + m[8] * dz;
    let qx, qy, qz, nx, ny, nz, d;
    if (c.k === K_BOX) {
        qx = clamp(lx, -c.hx, c.hx); qy = clamp(ly, -c.hy, c.hy); qz = clamp(lz, -c.hz, c.hz);
        const ex = lx - qx, ey = ly - qy, ez = lz - qz, d2 = ex * ex + ey * ey + ez * ez;
        if (d2 > 1e-10) { if (d2 >= r * r) return false; const dd = Math.sqrt(d2); nx = ex / dd; ny = ey / dd; nz = ez / dd; d = r - dd; }
        else {
            const ax = c.hx - Math.abs(lx), ay = c.hy - Math.abs(ly), az = c.hz - Math.abs(lz);
            nx = ny = nz = 0;
            if (ay <= ax && ay <= az) { ny = ly < 0 ? -1 : 1; d = r + ay; qy = ny * c.hy; }
            else if (ax <= az) { nx = lx < 0 ? -1 : 1; d = r + ax; qx = nx * c.hx; }
            else { nz = lz < 0 ? -1 : 1; d = r + az; qz = nz * c.hz; }
        }
    } else {
        const rad = Math.sqrt(lx * lx + lz * lz);
        qy = clamp(ly, -c.hy, c.hy);
        if (rad <= c.r) { qx = lx; qz = lz; } else { qx = lx / rad * c.r; qz = lz / rad * c.r; }
        const ex = lx - qx, ey = ly - qy, ez = lz - qz, d2 = ex * ex + ey * ey + ez * ez;
        if (d2 > 1e-10) { if (d2 >= r * r) return false; const dd = Math.sqrt(d2); nx = ex / dd; ny = ey / dd; nz = ez / dd; d = r - dd; }
        else {
            const ar = c.r - rad, ay = c.hy - Math.abs(ly);
            if (ay <= ar || rad < 1e-6) { nx = 0; nz = 0; ny = ly < 0 ? -1 : 1; d = r + ay; qy = ny * c.hy; }
            else { nx = lx / rad; nz = lz / rad; ny = 0; d = r + ar; qx = nx * c.r; qz = nz * c.r; }
        }
    }
    HIT.nx = m[0] * nx + m[1] * ny + m[2] * nz; HIT.ny = m[3] * nx + m[4] * ny + m[5] * nz; HIT.nz = m[6] * nx + m[7] * ny + m[8] * nz; HIT.d = d;
    HIT.px = c.p[0] + m[0] * qx + m[1] * qy + m[2] * qz; HIT.py = c.p[1] + m[3] * qx + m[4] * qy + m[5] * qz; HIT.pz = c.p[2] + m[6] * qx + m[7] * qy + m[8] * qz;
    return true;
}
// velocity of the point (x,y,z) riding on collider c over the last world update
const PV = { x: 0, y: 0, z: 0 };
function pointVel(c, x, y, z) {
    if (!c.mv) { PV.x = PV.y = PV.z = 0; return PV; }
    const m = c.m, pm = c.pm, dx = x - c.p[0], dy = y - c.p[1], dz = z - c.p[2];
    const lx = m[0] * dx + m[3] * dy + m[6] * dz, ly = m[1] * dx + m[4] * dy + m[7] * dz, lz = m[2] * dx + m[5] * dy + m[8] * dz;
    const ox = c.pp[0] + pm[0] * lx + pm[1] * ly + pm[2] * lz, oy = c.pp[1] + pm[3] * lx + pm[4] * ly + pm[5] * lz, oz = c.pp[2] + pm[6] * lx + pm[7] * ly + pm[8] * lz;
    const k = 1 / W.dt; PV.x = clamp((x - ox) * k, -25, 25); PV.y = clamp((y - oy) * k, -25, 25); PV.z = clamp((z - oz) * k, -25, 25);
    return PV;
}
function solidAt(x, y, z, r) { for (const c of W.cs) if (c.on && c.solid && sphCol(c, x, y, z, r)) return c; return null; }
function groundBelow(x, y, z, depth) { for (let d = 0.8; d <= depth; d += 0.9) if (solidAt(x, y - d, z, 0.4)) return true; return false; }

// ---------- a Tumbler body ----------
function mkBody(x, y, z, yaw) {
    return { p: { x, y, z }, v: { x: 0, y: 0, z: 0 }, yaw: yaw || 0, st: ST_RUN, t: 0, tt: 0, ground: false, gc: null, gv: { x: 0, y: 0, z: 0 },
        coy: 0, jb: 0, dived: false, slow: 1, sq: 0, sqv: 0, spin: { x: 0, z: 0 }, rx: 0, rz: 0, anim: 0, air: 0, fallV: 0, grab: false, ev: null };
}
function knock(b, vx, vy, vz, dur) {
    if (b.st === ST_TUMBLE && b.t < 0.25) return;
    b.st = ST_TUMBLE; b.t = 0; b.tt = dur || 1.1; b.v.x = vx; b.v.y = vy; b.v.z = vz; b.ground = false;
    const h = Math.hypot(vx, vz) || 1; b.spin.x = vz / h * 9; b.spin.z = -vx / h * 9;
    bodyEv(b, 'bonk');
}
// inp: {mx,mz world move dir, jump, dive (edge), grab (held)}  ex: {wind:{x,z}, hold:{x,y,z}, frozen, speed}
function stepBody(b, inp, dt, ex) {
    const v = b.v, p = b.p; ex = ex || {};
    b.t += dt; if (b.jb > 0) b.jb -= dt; if (inp.jump) b.jb = 0.14; b.coy -= dt;
    let st = b.st;
    if (st === ST_TUMBLE) { if (b.t > b.tt && b.ground) { b.st = ST_GETUP; b.t = 0; } }
    else if (st === ST_GETUP) { if (b.t > 0.38) { b.st = ST_RUN; b.t = 0; } }
    else if (st === ST_DIVE) { if (b.ground && b.t > 0.1) { b.st = ST_SLIDE; b.t = 0; bodyEv(b, 'land'); } }
    else if (st === ST_SLIDE) { if (b.t > 0.3) { b.st = ST_GETUP; b.t = 0.15; } }
    st = b.st;
    let ix = ex.frozen ? 0 : inp.mx || 0, iz = ex.frozen ? 0 : inp.mz || 0; const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
    const sp = RUN * b.slow * (ex.speed || 1), wx = ex.wind ? ex.wind.x : 0, wz = ex.wind ? ex.wind.z : 0;
    if (b.ground) {
        let tx = b.gv.x + wx, tz = b.gv.z + wz, acc;
        if (st === ST_RUN) { tx += ix * sp; tz += iz * sp; acc = 60; }
        else if (st === ST_GETUP) { tx += ix * sp * 0.3; tz += iz * sp * 0.3; acc = 30; }
        else if (st === ST_SLIDE) acc = 9; else if (st === ST_TUMBLE) acc = 6; else acc = 4;
        const dx = tx - v.x, dz = tz - v.z, dl = Math.hypot(dx, dz), mx = acc * dt;
        if (dl <= mx) { v.x = tx; v.z = tz; } else { v.x += dx / dl * mx; v.z += dz / dl * mx; }
    } else {
        if ((st === ST_RUN || st === ST_GETUP) && il > 0.05) {
            const tx = ix * sp, tz = iz * sp, dx = tx - v.x, dz = tz - v.z, dl = Math.hypot(dx, dz), mx = 16 * dt;
            if (dl <= mx) { v.x = tx; v.z = tz; } else { v.x += dx / dl * mx; v.z += dz / dl * mx; }
        }
        v.x += wx * 1.4 * dt; v.z += wz * 1.4 * dt;
    }
    if (ex.hold) {                       // being grabbed: pulled toward the grabber
        const dx = ex.hold.x - p.x, dz = ex.hold.z - p.z, d = Math.hypot(dx, dz);
        if (d > 1.0) { const k = Math.min(20, (d - 1.0) * 24) * dt; v.x += dx / d * k; v.z += dz / d * k; }
    }
    if (!ex.frozen && b.jb > 0 && (b.ground || b.coy > 0) && st === ST_RUN) {
        v.y = JUMP + Math.max(0, b.gv.y); b.ground = false; b.coy = 0; b.jb = 0; b.sqv -= 6; bodyEv(b, 'jump');
    }
    if (!ex.frozen && inp.dive && st === ST_RUN && !b.dived) {
        const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), along = Math.max(DIVE_H, (v.x - b.gv.x) * fx + (v.z - b.gv.z) * fz + 3);
        v.x = b.gv.x * 0.5 + fx * along; v.z = b.gv.z * 0.5 + fz * along; v.y = b.ground ? DIVE_V : Math.max(v.y, 2.5);
        b.dived = true; b.st = ST_DIVE; b.t = 0; b.ground = false; bodyEv(b, 'dive');
    }
    v.y -= GRAV * dt; if (v.y < -40) v.y = -40;
    if ((st === ST_RUN || st === ST_GETUP) && il > 0.1 && !ex.frozen) {
        const want = Math.atan2(ix, iz); b.yaw += clamp(angDiff(b.yaw, want), -15 * dt, 15 * dt);
    }
    // integrate in sub-steps so fast things do not tunnel
    const spd = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z), n = Math.min(6, Math.max(1, Math.ceil(spd * dt / 0.25))), h = dt / n;
    const was = b.ground, fallV = v.y; b.ground = false;
    for (let s = 0; s < n; s++) { p.x += v.x * h; p.y += v.y * h; p.z += v.z * h; collideBody(b); }
    if (!b.ground && was && v.y <= 0.5 && b.st !== ST_TUMBLE) {          // stay glued when walking down ramps / descending platforms
        const oy = p.y; p.y -= 0.22; collideBody(b); if (!b.ground) p.y = oy;
    }
    if (b.ground) {
        b.coy = 0.1; b.dived = false;
        if (!was) { if (fallV < -7) { b.sqv += Math.min(10, -fallV * 0.6); bodyEv(b, 'land'); } }
        b.air = 0;
    } else { b.air += dt; b.gv.x *= 0.98; b.gv.z *= 0.98; b.gv.y = 0; }
    // squash and stretch spring
    b.sqv += (-b.sq * 180 - b.sqv * 14) * dt; b.sq += b.sqv * dt; b.sq = clamp(b.sq, -0.35, 0.35);
    // tumble spin for the renderer
    if (b.st === ST_TUMBLE) { b.rx += b.spin.x * dt; b.rz += b.spin.z * dt; if (b.ground) { b.spin.x *= 0.9; b.spin.z *= 0.9; } }
    else { b.rx *= 0.8; b.rz *= 0.8; if (Math.abs(b.rx) < 0.01) b.rx = 0; if (Math.abs(b.rz) < 0.01) b.rz = 0; }
    const hs = Math.hypot(v.x - b.gv.x, v.z - b.gv.z); b.anim += hs * dt * 1.6;
}
function collideBody(b) {
    const p = b.p, v = b.v;
    for (let it = 0; it < 3; it++) {
        let any = false;
        for (const c of W.cs) {
            if (!c.on || !c.solid) continue;
            const dx = p.x - c.p[0], dy = p.y + 0.27 - c.p[1], dz = p.z - c.p[2], rr = c.br + 0.8;
            if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
            for (let k = 0; k < 2; k++) {
                if (!sphCol(c, p.x, p.y + (k ? PH : 0), p.z, PR)) continue;
                any = true;
                const nx = HIT.nx, ny = HIT.ny, nz = HIT.nz, d = HIT.d;
                p.x += nx * d; p.y += ny * d; p.z += nz * d;
                pointVel(c, HIT.px, HIT.py, HIT.pz);
                const fx = c.fx, rx = v.x - PV.x, ry = v.y - PV.y, rz = v.z - PV.z, vn = rx * nx + ry * ny + rz * nz;
                if (fx && fx.knock && b.st !== ST_TUMBLE) {
                    const pl = Math.hypot(PV.x, PV.y, PV.z);
                    if (pl > 1.6 || fx.always) {
                        const k2 = fx.knock, hz = Math.hypot(nx, nz) || 1;
                        let kx = PV.x * 0.55 + nx / hz * k2 * 0.55, kz = PV.z * 0.55 + nz / hz * k2 * 0.55; const kh = Math.hypot(kx, kz); if (kh > 11) { kx *= 11 / kh; kz *= 11 / kh; }
                        knock(b, kx, Math.max(4, PV.y * 0.5 + 3.5 + k2 * 0.2), kz, 0.9 + k2 * 0.04);
                        continue;
                    }
                }
                if (vn < 0) {
                    if (fx && fx.bounce && ny > 0.5) { v.y = fx.bounce + PV.y; v.x += (fx.bx || 0); v.z += (fx.bz || 0); b.sqv += 8; bodyEv(b, 'boing'); if (b.st === ST_DIVE) { b.st = ST_RUN; } }
                    else { const e = b.st === ST_TUMBLE && vn < -3 ? 0.35 : 0; v.x -= (1 + e) * vn * nx; v.y -= (1 + e) * vn * ny; v.z -= (1 + e) * vn * nz; }
                }
                if (ny > 0.55) {
                    b.ground = true; b.gc = c;
                    b.gv.x = PV.x + (fx && fx.conv ? fx.conv[0] : 0); b.gv.y = PV.y; b.gv.z = PV.z + (fx && fx.conv ? fx.conv[1] : 0);
                }
            }
        }
        if (!any) break;
    }
}
