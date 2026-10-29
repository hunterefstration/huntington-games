// ---------------- particles ----------------
function emit(sys, x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag, grav) {
  if (sys.userData.skip) return; const U = sys.userData; if (SET.particles < 100 && Math.random() * 100 > SET.particles + 25) return;
  const p = U.p[U.head]; U.head = (U.head + 1) % U.n; p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.c0 = c0; p.c1 = c1; p.drag = drag === undefined ? 1 : drag; p.grav = grav || 0;
}
function updParticles(sys, dt) {
  const U = sys.userData, pos = U.pos, col = U.colr, sz = U.sz; let n = 0;
  for (let i = 0; i < U.n; i++) {
    const p = U.p[i]; if (p.life <= 0) { sz[i] = 0; continue; }
    p.life -= dt; if (p.life <= 0) { sz[i] = 0; continue; }
    const t = 1 - p.life / p.max; const k = Math.pow(p.drag, dt * 60); p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; sz[i] = lerp(p.s0, p.s1, t);
    col[i * 4] = lerp(p.c0[0], p.c1[0], t); col[i * 4 + 1] = lerp(p.c0[1], p.c1[1], t); col[i * 4 + 2] = lerp(p.c0[2], p.c1[2], t); col[i * 4 + 3] = lerp(p.c0[3], p.c1[3], t); n++;
  }
  const g = sys.geometry; g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
}
const FOAM0 = [.92, .97, 1, .75], FOAM1 = [.85, .93, 1, 0];
const SMK = [.38, .37, .35, .42], SMK2 = [.55, .55, .55, 0], FIRE0 = [1, .75, .3, .9], FIRE1 = [.9, .2, .05, 0], DUST0 = [.62, .55, .42, .5], DUST1 = [.62, .55, .42, 0];
function explode(size, x, y, z, flag) {
  const n = size * 5 + 3; const f0 = flag === 2 ? [.5, .8, 1, .9] : FIRE0, f1 = flag === 2 ? [.1, .3, 1, 0] : FIRE1;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rr(1, 4 + size * 2.5); emit(pFire, x, y, z, Math.cos(a) * s, rr(1, 4 + size * 2), Math.sin(a) * s, rr(.25, .5 + size * .12), rr(1.2, 2.2) * (1 + size * .55), 0.3, f0, f1, .92, 3); }
  for (let i = 0; i < n * .8; i++) { const a = Math.random() * TAU, s = rr(.5, 2 + size); emit(pSmoke, x, y + .5, z, Math.cos(a) * s, rr(1.5, 3.5 + size * .8), Math.sin(a) * s, rr(.8, 1.5 + size * .4), rr(1.4, 2.2) * (1 + size * .4), rr(3, 5) * (1 + size * .5), flag === 1 ? DUST0 : SMK, flag === 1 ? DUST1 : SMK2, .96, -.5); }
  emit(pFire, x, y + .4, z, 0, 0, 0, .18, 4 + size * 3, 8 + size * 4, [1, .95, .7, .9], [1, .6, .2, 0], 1, 0);
  if (size >= 2 && flag !== 1) { for (let i = 0; i < size * 3; i++) { const a = Math.random() * TAU, s = rr(4, 9 + size * 2); emit(pFire, x, y, z, Math.cos(a) * s, rr(5, 10), Math.sin(a) * s, rr(.4, .9), .35, .15, [1, .85, .4, 1], [1, .3, .1, 0], .97, 14); } }
  if (size >= 2 && scorchPool && flag !== 2) { const i = scorchPool.count < 70 ? scorchPool.count++ : (decals._h = ((decals._h || 0) + 1) % 70); _m.makeScale(1 + size * 1.3, 1, 1 + size * 1.3); _m.setPosition(x, W.M.H(x, z) + .12, z); scorchPool.setMatrixAt(i, _m); scorchPool.instanceMatrix.needsUpdate = true; }
  sfx(size >= 3 ? 'boomL' : 'boom', x, z);
}

// ---------------- fx events ----------------
const WK_COL = [[1, .9, .45], [.85, .85, .85], [1, .75, .4], [1, .6, .3], [.7, .95, 1], [1, 1, 1], [1, .6, .3], [1, .85, .45], [.6, .8, 1], [.7, .9, 1], [1, .5, .3], [.4, .9, 1], [.45, .9, 1], [.85, .7, 1]];   // 11 pulse, 12 plasma, 13 rail (3.0)
const MZ0 = [1, .9, .5, 1], MZ1 = [1, .5, .1, 0], MZL0 = [.6, .95, 1, 1], MZL1 = [.1, .5, 1, 0];   // muzzle flash colours (Legion = cyan)
function fxEvent(e) {
  switch (e[0]) {
    case 0: { // shot: k,sx,sy,sz,tx,ty,tz,dur,src,arc
      MUS.shots++;
      const k = e[1], dur = e[8]; const s = [e[2], e[3], e[4]], t = [e[5], e[6], e[7]];
      if (!visPoint(s[0], s[2]) && !visPoint(t[0], t[2])) return;
      const lg = k >= 11;   // 3.0 Legion energy weapons
      const nk = W.wx.night ? 1.9 : 1; if (nk > 1 && k !== 5) nightFlash(s[0], s[2], lg);
      if (dur <= 0) { tracers.push({ s, t, age: 0, d: k === 5 || k === 13 ? .2 : .1, k }); emit(pFire, s[0], s[1], s[2], 0, 0, 0, .07, (k === 5 || k === 13 ? 1.0 : .8) * nk, .2, lg ? MZL0 : MZ0, lg ? MZL1 : MZ1, 1, 0); sfx(k === 5 || k === 13 ? 'snipe' : k === 4 ? 'flak' : k === 11 ? 'pulse' : 'shot', s[0], s[2]); }
      else { vprojs.push({ s, t, t0: performance.now() / 1000, dur, k, arc: e[10] }); emit(pFire, s[0], s[1], s[2], 0, 0, 0, .12, 1.6 * nk, .4, lg ? MZL0 : [1, .85, .4, 1], lg ? MZL1 : [1, .4, .1, 0], 1, 0); sfx(k === 1 || k === 9 ? 'rocket' : k === 12 ? (e[10] ? 'howl' : 'plasma') : k === 2 ? 'howl' : k === 3 ? 'bombdrop' : 'cannon', s[0], s[2]); }
      const src = W.byId.get(e[9]); if (src && src.k === 'b') { src.fire = .2; } if (src && src.k === 'u') src.firing = .2; if (W.mirror && src && src.k === 'b') src.aim = Math.atan2(t[0] - src.x, t[2] - src.z);
      break;
    }
    case 1: if (visPoint(e[2], e[4])) explode(e[1], e[2], e[3], e[4], e[5]); break;
    case 2: { // death
      const T = UT[UTK[e[1]]]; if (!T || !visPoint(e[2], e[4])) break; const x = e[2], y = e[3], z = e[4];
      if (T.cls === 0) { for (let i = 0; i < 4; i++) emit(pSmoke, x, y + .6, z, rr(-.8, .8), rr(.5, 1.5), rr(-.8, .8), rr(.5, 1), .8, 1.8, DUST0, DUST1, .95, 0); sfx('die', x, z); }
      else if (T.air) { explode(2, x, y, z, 0); for (let i = 0; i < 18; i++) emit(pSmoke, x + rr(-1, 1), y, z + rr(-1, 1), rr(-2, 2), rr(-2, 2), rr(-2, 2), rr(1.5, 3), 1.6, 3.6, SMK, SMK2, .97, 3); }
      else { for (let i = 0; i < 5; i++) emit(pSmoke, x, y + 1, z, rr(-1.5, 1.5), rr(2, 5), rr(-1.5, 1.5), rr(1.5, 3), 1.8, 4, SMK, SMK2, .97, -.4); wrecks.push({ x, y, z, rot: e[5], t: 26, sc: T.r * .6, sm: 0 }); if (wrecks.length > 28) wrecks.shift(); }
      break;
    }
    case 3: uiAlert(e); break;
    case 4: jets.push({ k: e[1], sx: e[2], sz: e[3], ex: e[4], ez: e[5], t0: performance.now() / 1000, dur: e[6] }); sfx('jet', e[2], e[3]); break;
    case 5: { const n = e[5]; for (let i = 0; i < n; i++) crates.push({ x: e[2] + Math.cos(i / n * TAU) * (n > 3 ? 4.5 : 3) * (e[1] & 1 ? .4 : 1), z: e[3] + Math.sin(i / n * TAU) * (n > 3 ? 4.5 : 3) * (e[1] & 1 ? .4 : 1), t0: performance.now() / 1000, dur: e[4], big: e[1] & 1, pod: e[1] & 2, dx: e[1] & 2 ? 0 : (Math.random() - .5) * 8 }); sfx(e[1] & 2 ? 'howl' : 'para', e[2], e[3]); break; }
    case 6: if (W.mirror && e[4] === 0 && e[5] === ME) W.reveals.push({ team: MYTEAM, x: e[1], z: e[2], r: e[3], t: 22 }); markers.push({ x: e[1], z: e[2], r: e[3], t0: performance.now() / 1000, dur: 1.4, col: e[4] === 1 ? [1, .4, .3] : e[4] === 2 ? [.5, 1, .7] : [.4, .85, 1] }); break;
    case 7: uiPointEvent(e); break;
    case 8: { const u = W.byId.get(e[1]); if (u) { for (let i = 0; i < 10; i++) emit(pFire, e[3], e[5] + 1, e[4], rr(-1, 1), rr(1, 4), rr(-1, 1), rr(.5, 1), .5, .2, [1, .9, .3, 1], [1, .6, .1, 0], .96, 2); sfx('vet', e[3], e[4]); } break; }
    case 9: { const b = W.byId.get(e[1]); if (b && b.owner === ME) sfx('done', e[2], e[3]); for (let i = 0; i < 8; i++) emit(pSmoke, e[2] + rr(-3, 3), 1, e[3] + rr(-3, 3), 0, rr(1, 3), 0, rr(.6, 1.1), 1.3, 3, DUST0, DUST1, .95, 0); break; }
    case 11: uiChat(e[1], e[2]); break;
    case 12: uiGameOver(e); break;
  }
}
function visPoint(x, z) { return !W.o.fog || seen(MYTEAM, x, z); }

// ---------------- per frame ----------------
const _col = new THREE.Color();
function interpHost(alpha) {
  const M = W.M;
  for (const u of W.units) {
    u.rx = u.px + (u.x - u.px) * alpha; u.rz = u.pz + (u.z - u.pz) * alpha; u.rrot = u.prot + angDiff(u.prot, u.rot) * alpha; u.raim = u.paim + angDiff(u.paim, u.aim) * alpha; u.hpf = u.hp / u.maxHp; u.ry = u.T.air ? u.y : u.T.naval ? M.wl : M.H(u.rx, u.rz);
    u.vx = u.vx;
  }
}
// smooth, damped camera. Pitch stays near 50-58 degrees; never dips below the terrain.
const camPitch = d => lerp(.9, 1.0, sstep(40, 125, d));
function setCamera(dt) {
  const M = W.M, kp = 1 - Math.exp(-dt * 8);
  cam.x += (cam.tx - cam.x) * kp; cam.z += (cam.tz - cam.z) * kp;
  cam.dist += (cam.tdist - cam.dist) * (1 - Math.exp(-dt * 7));
  cam.yaw += angDiff(cam.yaw, cam.tyaw) * (1 - Math.exp(-dt * 7));
  const gy0 = (M.H(cam.x, cam.z) * 2 + M.H(cam.x + 7, cam.z) + M.H(cam.x - 7, cam.z) + M.H(cam.x, cam.z + 7) + M.H(cam.x, cam.z - 7)) / 6;
  cam.gy += (gy0 - cam.gy) * (1 - Math.exp(-dt * 4));
  const d = cam.dist, pitch = camPitch(d), hr = Math.cos(pitch) * d, hh = Math.sin(pitch) * d;
  const px = cam.x + Math.sin(cam.yaw) * hr, pz = cam.z + Math.cos(cam.yaw) * hr, py = cam.gy + hh;
  let need = 0;
  for (let i = 1; i <= 10; i++) { const t = i / 10, ray = lerp(cam.gy, py, t), th = M.H(lerp(cam.x, px, t), lerp(cam.z, pz, t)) + 3.2 + 5 * t; if (th - ray > need) need = th - ray; }
  cam.lift += (need - cam.lift) * (1 - Math.exp(-dt * (need > cam.lift ? 14 : 3)));
  camera.position.set(px, py + cam.lift, pz); camera.lookAt(cam.x, cam.gy, cam.z); camera.updateMatrixWorld();
  sun.position.set(cam.x + 55, 100, cam.z + 38); sun.target.position.set(cam.x, 0, cam.z); sun.target.updateMatrixWorld();
  const ex = clamp(d * .8, 40, 120); const sc = sun.shadow.camera; if (sc.right !== ex) { sc.left = -ex; sc.right = ex; sc.top = ex; sc.bottom = -ex; sc.updateProjectionMatrix(); }
}
function w2s(x, y, z, out) { _v2.set(x, y, z).project(camera); out.x = (_v2.x * .5 + .5) * vpW; out.y = (-_v2.y * .5 + .5) * vpH; out.z = _v2.z; return out; }
const _ray = new THREE.Vector3();
function screenToGround(sx, sy, out) {
  _ray.set(sx / vpW * 2 - 1, -(sy / vpH) * 2 + 1, .5).unproject(camera).sub(camera.position).normalize();
  const o = camera.position, M = W.M; let t = 0, prev = 0, hit = false;
  for (let i = 0; i < 160; i++) { t += 2.5 + i * .12; const x = o.x + _ray.x * t, y = o.y + _ray.y * t, z = o.z + _ray.z * t; if (y <= Math.max(M.H(x, z), M.wl)) { hit = true; break; } prev = t; if (t > 700) break; }
  if (!hit) { out.x = o.x; out.z = o.z; out.ok = false; return out; }
  let a = prev, b = t; for (let i = 0; i < 8; i++) { const m = (a + b) / 2, y = o.y + _ray.y * m; if (y <= Math.max(M.H(o.x + _ray.x * m, o.z + _ray.z * m), M.wl)) b = m; else a = m; }
  out.x = o.x + _ray.x * b; out.z = o.z + _ray.z * b; out.ok = true; return out;
}
function myVisible(e) { if (e.team === MYTEAM) return true; if (!W.o.fog) return true; return seen(MYTEAM, e.rx !== undefined ? e.rx : e.x, e.rz !== undefined ? e.rz : e.z); }
let tAccum = 0, fogT = 0, weatherAcc = 0;
function renderFrame(dt, now) {
  tAccum += dt; const t = now / 1000; const M = W.M;
  setCamera(dt); _frustum.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  // ---- units ----
  for (const k in unitPools) unitPools[k].begin();
  const bars = barPool.userData; let nb = 0; const ip = bars.ip.array, idd = bars.id.array;
  const addBar = (x, y, z, w, hp, vet, mode, sh) => { if (nb >= 300 || cam.dist > 140) return; const j = nb * 4; ip[j] = x; ip[j + 1] = y; ip[j + 2] = z; ip[j + 3] = w; idd[j] = hp; idd[j + 1] = vet; idd[j + 2] = mode; idd[j + 3] = sh || 0; nb++; };   // sh = energy shield left (3.0)
  const rings = ringPool; let nr = 0; const rcol = rings.instanceColor.array;
  const addRing = (x, z, r, cr, cg, cb) => { if (nr >= 3000) return; _m.makeScale(r, 1, r); _m.setPosition(x, M.H(x, z) + .22, z); rings.setMatrixAt(nr, _m); rcol[nr * 3] = cr; rcol[nr * 3 + 1] = cg; rcol[nr * 3 + 2] = cb; nr++; };
  let nbl = 0; const blob = blobPool;
  for (const u of W.units) {
    if (!myVisible(u) || !inView(u.rx, u.ry, u.rz, u.T.r + 9)) continue; const T = u.T; const pc = P(u.owner).color; _col.set(pc); let y = u.ry, sc = T.cls === 0 ? 1.18 : 1;
    if (T.jump && u.moving) y += Math.abs(Math.sin(t * 4.2 + u.id)) * 1.5; else if (T.cls === 0 && u.moving) y += Math.abs(Math.sin(t * 11 + u.id)) * .13; else if (T.walker && u.moving) y += Math.abs(Math.sin(t * 3.4 + u.id)) * .38 * Math.max(.7, T.r / 2.5); if (T.air) y += Math.sin(t * 2 + u.id) * .25; if (T.hover) y += .25 + Math.sin(t * 2.2 + u.id) * .1;
    if (T.naval) { y += Math.sin(t * 1.7 + u.id) * .08; if (u.moving && Math.random() < dt * 16) { const a = u.rrot, L = T.r * 1.25; emit(pSmoke, u.rx - Math.sin(a) * L + rr(-.4, .4), M.wl + .2, u.rz - Math.cos(a) * L + rr(-.4, .4), rr(-.5, .5), .2, rr(-.5, .5), rr(.9, 1.5), .8, 2.4, FOAM0, FOAM1, .95, 0); } }   // 3.0 ships bob and leave a wake   // 3.0: jump jets bound, hover tanks float
    const fl = u.flash > 0 ? Math.min(1, u.flash * 6) * .6 : u.shF > 0 ? -Math.min(1, u.shF * 8) * .85 : (u.shield > 0 ? .25 : 0);   // negative = cyan shield flash
    const dispAim = (u.o === 0 || u.o === 4) && !u.tgt && T.cls === 0 && !u.firing ? u.rrot : u.raim;
    uPool(u.type).add(u.rx, y, u.rz, u.rrot, T.cls === 0 ? dispAim : u.raim, sc, _col.r, _col.g, _col.b, fl, t);
    if ((T.air || !SET.shadows) && !T.naval && nbl < 400) { const br = T.air ? T.r * 1.3 : T.cls === 0 ? 1.05 : T.r * 1.25; _m.makeScale(br, 1, br * (T.air || T.cls === 0 ? 1 : 1.35)); _m.setPosition(u.rx, M.H(u.rx, u.rz) + .2, u.rz); blob.setMatrixAt(nbl++, _m); }
    const sel = selIds.has(u.id), hov = hoverId === u.id;
    if (sel) { addRing(u.rx, u.rz, T.r * 1.35 + .3, .35, 1, .5); if (u.guard && u.owner === ME) addRing(u.guard[2], u.guard[3], 2.2, .4, .85, 1); } else if (hov) addRing(u.rx, u.rz, T.r * 1.35 + .3, 1, .9, .4);
    const shf = u.shpMax ? u.shp / u.shpMax : (u.shUp ? 1 : 0);
    if (u.hpf < .999 || sel || hov || SET.hpAlways || u.vet > 0 && sel || (u.shpMax && shf < .999)) addBar(u.rx, y + (T.bh || (T.cls === 0 ? 2.6 : T.air ? 3.2 : T.walker ? 8.6 : 3.4)), u.rz, T.bw || (T.cls === 0 ? 1.9 : T.walker ? 4.4 : 2.8), u.hpf, u.vet, 0, shf);
    if (u.owner !== ME && u.team !== MYTEAM && hov) addRing(u.rx, u.rz, T.r * 1.4 + .3, 1, .3, .3);
  }
  blob.count = nbl; blob.instanceMatrix.needsUpdate = true;
  for (const k in unitPools) unitPools[k].end();
  // wrecks
  if (!POOLS.wreck) POOLS.wreck = new Pool(MDL.wreck, 40, MAT_I, false); const wp = POOLS.wreck; wp.begin();
  for (let i = wrecks.length - 1; i >= 0; i--) { const w = wrecks[i]; w.t -= dt; if (w.t <= 0) { wrecks.splice(i, 1); continue; } if (myVisible({ team: -1, x: w.x, z: w.z })) { wp.add(w.x, w.y, w.z, w.rot, w.rot, w.sc, 0, 0, 0, 0, t); if ((w.sm -= dt) <= 0) { w.sm = .35; emit(pSmoke, w.x, w.y + 1, w.z, rr(-.2, .2), rr(1.5, 2.5), rr(-.2, .2), rr(1.5, 2.5), .7, 1.9, SMK, SMK2, .98, -.2); } } }
  wp.end();
  // ---- buildings ----
  for (const k in bPools) bPools[k].begin(); flagPool.begin(); beaconPool.begin(); for (const wpool of wallPools) wpool.begin(); for (const wpool of wallPoolsL) if (wpool) wpool.begin();
  const fireT = t;
  for (const b of W.bld) {
    if (b.team !== MYTEAM && W.o.fog && !(b.sb >> MYTEAM & 1) && !seen(MYTEAM, b.x, b.z)) continue;
    if (b.type === 'wall') {
      const pc = P(b.owner).color; _col.set(pc); const pool = bFac(b) ? (wallPoolsL[b.lvl - 1] || (wallPoolsL[b.lvl - 1] = new Pool(MDL.wallsegL, 900, MAT_I, true))) : wallPools[b.lvl - 1]; const pt = W.pts[b.pt]; const arcs = wallArcs(pt); const hs = [.8, 1.1, 1.45][b.lvl - 1] * (b.prog < 1 ? .3 + .7 * b.prog : 1) * (b.spec === 'bulwark' ? 1.2 : 1);
      for (const a of arcs) { const len = (a[1] - a[0]) * a[2], n = Math.floor(len / 2.0); for (let i = 0; i <= n; i++) { const ang = a[0] + (a[1] - a[0]) * (i / n); const wx = pt.x + Math.cos(ang) * a[2], wz = pt.z + Math.sin(ang) * a[2]; const idx = pool.n; pool.add(wx, M.H(wx, wz) - .1, wz, 0, 0, 1, _col.r, _col.g, _col.b, b.flash > 0 ? .4 : 0, t); pool.setMatrix(idx, wx, M.H(wx, wz) - .1, wz, -ang, 1.0 + b.lvl * .12, hs, 1); } }
      if (selBld === b.id) addRing(pt.x, pt.z, pt.hq >= 0 ? 19.5 : 13.5, .35, 1, .5);
      if (b.hp < b.maxHp * .999 || b.prog < 1 || selBld === b.id) addBar(pt.x, M.H(pt.x, pt.z) + 5, pt.z + 0, 6, b.hp / b.maxHp, 0, b.prog < 1 ? 2 : 0);
      continue;
    }
    if (!inView(b.x, b.y, b.z, b.T.sz + 12)) continue;
    const pool = bPool(b); const pc = P(b.owner).color; _col.set(pc); let sc = 1; const fl = b.flash > 0 ? .5 : (b.prog < 1 ? .18 + .1 * Math.sin(t * 6) : 0);
    const bsc = b.type === 'nest' ? 1 : 1; const idx = pool.n; pool.add(b.x, b.y, b.z, b.rot, b.aim, sc, _col.r, _col.g, _col.b, fl, t);
    if (b.prog < 1) { const k = .3 + .7 * b.prog; for (const m of pool.meshes) { const a = m.instanceMatrix.array, o = idx * 16; a[o + 5] = k; } }
    if (b.spec && b.type !== 'hq') { const bi = beaconPool.n; const sci = BT[b.type].specs.findIndex(s => s.id === b.spec); const cc = [0xffd24a, 0x5ad1ff, 0xff7a5a][Math.max(0, sci)]; _col.set(cc); beaconPool.add(b.x, b.y + b.T.sz + 3.6 + Math.sin(t * 2 + b.id) * .2, b.z, t * 1.5, t * 1.5, .7, _col.r, _col.g, _col.b, 0, t); }
    const sel = selBld === b.id; if (sel) { addRing(b.x, b.z, b.T.sz * .85 + 1.2, .35, 1, .5); if (b.hasRally && b.owner === ME) addRing(b.rx, b.rz, 1.6, .4, .7, 1); }
    if (b.fire > 0 && b.w) { const aim = b.aim; emit(pFire, b.x + Math.sin(aim) * 2, b.y + b.T.sz * .55 + 1.6, b.z + Math.cos(aim) * 2, 0, 0, 0, .06, .9, .2, [1, .9, .5, 1], [1, .5, .1, 0], 1, 0); }
    const dmg = b.hp < b.maxHp * .999; if (dmg || b.prog < 1 || b.upg || sel || SET.hpAlways) addBar(b.x, b.y + b.T.sz * .9 + 3.8, b.z, 5, b.prog < 1 ? b.prog : (b.upg ? b.upg.t / b.upg.dur : b.hp / b.maxHp), 0, (b.prog < 1 || b.upg) ? 2 : 0);
    if (dmg && b.hp < b.maxHp * .5 && Math.random() < dt * 6 * (1 - b.hp / b.maxHp)) emit(pSmoke, b.x + rr(-2, 2), b.y + b.T.sz * .6, b.z + rr(-2, 2), 0, rr(2, 3), 0, rr(1, 1.8), 1.2, 3, SMK, SMK2, .98, -.2);
  }
  // control point objects
  let npd = 0; const flags = flagPool;
  for (const o of ptObjs) {
    const pt = o.pt; o.mat.uniforms.uT.value = t; let c = 0x8a8f96, c2 = 0xffffff;
    if (pt.owner >= 0) c = P(pt.owner).color; if (pt.capP >= 0) c2 = P(pt.capP).color; else c2 = 0xffffff;
    o.mat.uniforms.uCol.value.set(c); o.mat.uniforms.uCol2.value.set(pt.owner >= 0 ? (pt.ctrl < 1 ? 0xffffff : c) : c2); o.mat.uniforms.uProg.value = pt.ctrl; o.mat.uniforms.uCont.value = pt.contested ? 1 : 0;
    const fcol = new THREE.Color(pt.owner >= 0 ? c : (pt.capP >= 0 && pt.ctrl > 0 ? c2 : 0x9a9fa6)); const fy = pt.y + (pt.hq >= 0 ? 0 : 0) - 6.2 + 6.0 * (pt.owner >= 0 ? .5 + .5 * pt.ctrl : pt.ctrl * .6);
    if (pt.hq < 0) flags.add(pt.x, pt.y + .1 + (pt.owner >= 0 ? 0 : -3.0 * (1 - pt.ctrl)), pt.z, 0.0, 0, 1, fcol.r, fcol.g, fcol.b, pt.flash > 0 ? .4 : 0, t);
    // slot pads for own owned points
    if (pt.owner === ME && selPad && selPad.pt === pt.id) for (let k = 0; k < pt.slots.length; k++) { if (pt.slots[k].b) continue; if (npd >= 120) break; const s = pt.slots[k]; _m.makeScale(4.4 + (selPad.slot === k ? .6 : 0), 1, 4.4); _m.setPosition(s.x, s.y + .22, s.z); const pc = padPool.instanceColor.array, j = npd * 3; if (s.sea) { pc[j] = .45; pc[j + 1] = .82; pc[j + 2] = 1; } else { pc[j] = 1; pc[j + 1] = .83; pc[j + 2] = .42; } padPool.setMatrixAt(npd++, _m); }   // 3.0: the coastal (Shipyard) pad is blue
    if (pt.owner === ME && !pt.wall && !HIDEPADS && pt.owner >= 0) { }
    const sp = o.sp || (o.sp = { x: 0, y: 0, z: 0 }); w2s(pt.x, pt.y + 9, pt.z, sp);
    const vis = sp.z < 1 && sp.x > -40 && sp.x < vpW + 40 && sp.y > 128 && sp.y < vpH - hudDeckPx() && cam.dist < 170 && inGame && !SCREEN;
    if (vis) {
      const lb = o.label, own = pt.owner === ME, free = own && pt.slots.some(s => !s.b); const nm = pt.hq >= 0 ? (pt.owner >= 0 ? P(pt.owner).name + "'s base" : 'Empty base') : pt.name; const key = nm + '|' + pt.owner + '|' + free + '|' + pt.contested;
      if (o.key !== key) { o.key = key; lb.innerHTML = '<span class="dot" style="background:' + (pt.owner >= 0 ? hex3(P(pt.owner).color) : '#8d97a3') + '"></span><span class="nm">' + esc(nm) + '</span>' + (free ? '<button class="lb">+ Build</button>' : ''); const bt = lb.querySelector('.lb'); if (bt) bt.onclick = e => { e.stopPropagation(); initAudio(); selectPoint(pt); sfx('click'); }; }
      lb.style.display = 'flex'; lb.style.transform = 'translate(' + (sp.x | 0) + 'px,' + (sp.y | 0) + 'px) translate(-50%,-100%)';
    } else o.label.style.display = 'none';
  }
  padPool.count = npd; padPool.instanceMatrix.needsUpdate = true; padPool.instanceColor.needsUpdate = true;
  // 3.0 field events: crate rings, ace markers, artillery strike zones
  if (W.fev) for (const e of W.fev) {
    const pul = .5 + .5 * Math.sin(t * 5);
    if (e.k === 'crate') { if (e.t < e.land) continue; addRing(e.x, e.z, 7, 1, .82, .25); addRing(e.x, e.z, 7 * (e.hold / 5) + .3, .4, 1, .55); }
    else if (e.k === 'strike') { const f = clamp((e.t + (W.t % 1)) / e.life, 0, 1); for (let k = 0; k < 30; k++) { const a = k / 30 * TAU + t * .25; addRing(e.x + Math.cos(a) * e.r, e.z + Math.sin(a) * e.r, .85, 1, .22 + .25 * pul, .18); } for (let k = 0; k < 18; k++) { const a = k / 18 * TAU - t * .4, rr_ = e.r * (1 - f); addRing(e.x + Math.cos(a) * rr_, e.z + Math.sin(a) * rr_, .55, 1, .6, .3); } }
    else if (e.k === 'ace') { const u = W.byId.get(e.uid); if (!u || u.dead || !myVisible(u)) continue; addRing(u.rx, u.rz, u.T.r * 1.6 + .8, 1, .82, .2); _col.set(0xffd24a); beaconPool.add(u.rx, u.ry + (u.T.cls === 0 ? 4 : u.T.bh ? u.T.bh + 2.5 : u.T.walker ? 11 : 6) + Math.sin(t * 3) * .3, u.rz, t * 2, t * 2, .6, _col.r, _col.g, _col.b, 0, t); }
  }
  for (const k in bPools) bPools[k].end(); flagPool.end(); beaconPool.end(); for (const wpool of wallPools) wpool.end(); for (const wpool of wallPoolsL) if (wpool) wpool.end();
  // ---- projectiles / tracers / jets / crates ----
  vprojPool.begin(); if (vprojPoolL) vprojPoolL.begin(); const nowS = performance.now() / 1000;
  for (let i = vprojs.length - 1; i >= 0; i--) {
    const p = vprojs[i]; const f = (nowS - p.t0) / p.dur; if (f >= 1) { vprojs.splice(i, 1); continue; }
    const x = lerp(p.s[0], p.t[0], f), z = lerp(p.s[2], p.t[2], f); let y = lerp(p.s[1], p.t[1], f); let dy = p.t[1] - p.s[1]; const hArc = p.arc ? Math.min(40, 6 + Math.hypot(p.t[0] - p.s[0], p.t[2] - p.s[2]) * .35) : 0; if (p.arc) { y += hArc * 4 * f * (1 - f); dy += hArc * 4 * (1 - 2 * f); }
    const dx = p.t[0] - p.s[0], dz = p.t[2] - p.s[2]; const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, Math.hypot(dx, dz) + .01);
    if (p.k === 10) { y = lerp(p.s[1], p.t[1], f * f); }
    const vp = p.k === 12 ? (vprojPoolL || (vprojPoolL = new Pool([part(new GB().box(.34, .34, 1.5, 0, 0, 0, 0x8ff0ff))], 120, MAT_I, false))) : vprojPool;   // 3.0 plasma bolts glow cyan
    const idx = vp.n; vp.add(x, y, z, yaw, yaw, p.k === 3 || p.k === 10 ? 1.6 : p.k === 2 ? 1.3 : 1, 1, .85, .5, 0, 0);
    { const m = vp.meshes[0]; const a = m.instanceMatrix.array, o = idx * 16; _eu.set(pitch, yaw, 0, 'YXZ'); _q.setFromEuler(_eu); _m.compose(_v1.set(x, y, z), _q, _sc.set(p.k === 3 || p.k === 10 ? 2.2 : 1, p.k === 3 || p.k === 10 ? 2.2 : 1, p.k === 2 ? 1.6 : 1)); _m.toArray(a, o); }
    if (p.k === 1 || p.k === 9 || p.k === 10) { emit(pSmoke, x, y, z, rr(-.2, .2), rr(-.2, .2), rr(-.2, .2), .6, .9, 1.7, [.8, .8, .8, .5], [.6, .6, .6, 0], .95, 0); emit(pFire, x, y, z, 0, 0, 0, .1, .8, .2, [1, .8, .4, 1], [1, .3, .1, 0], 1, 0); }
    else if (p.k === 2) { if (Math.random() < .5) emit(pSmoke, x, y, z, 0, 0, 0, .5, .5, 1.2, [.7, .7, .7, .35], [.6, .6, .6, 0], .95, 0); }
    else if (p.k === 12) { if (Math.random() < .7) emit(pFire, x, y, z, 0, 0, 0, .14, .9, .25, MZL0, MZL1, 1, 0); }
    else if (p.k === 3) { }
  }
  vprojPool.end(); if (vprojPoolL) vprojPoolL.end();
  // tracers as line segments
  drawTracers(dt);
  // crates & jets
  if (!POOLS.crate) POOLS.crate = new Pool(MDL.crate, 24, MAT_I, false); const cp = POOLS.crate; cp.begin();
  if (!POOLS.pod) POOLS.pod = new Pool(MDL.pod, 16, MAT_I, false); const pdp = POOLS.pod; pdp.begin();   // 3.0 Legion drop pods
  for (let i = crates.length - 1; i >= 0; i--) { const c = crates[i]; const f = (nowS - c.t0) / c.dur; if (f >= 1) { crates.splice(i, 1); continue; } const gy = M.H(c.x, c.z);
    if (c.pod) { const y = gy + (1 - f) * 80, sc = c.big ? 1.5 : 1; pdp.add(c.x, y, c.z, f * .6, f * .6, sc, 1, 1, 1, 0, 0); if (Math.random() < .6) emit(pFire, c.x, y + 2.9 * sc, c.z, rr(-.3, .3), 4, rr(-.3, .3), .18, 1.4 * sc, .4, MZL0, MZL1, 1, 0); continue; }
    const y = gy + (1 - f) * (1 - f) * 70; cp.add(c.x + c.dx * (1 - f) * .4, y, c.z, f * 2, f * 2, c.big ? 1.2 : .8, 1, 1, 1, 0, 0); }
  cp.end(); pdp.end();
  if (!POOLS.cratel) POOLS.cratel = new Pool(MDL.cratel, 8, MAT_I, true); const clp = POOLS.cratel; clp.begin();
  if (W.fev) for (const e of W.fev) if (e.k === 'crate' && e.t >= e.land) clp.add(e.x, M.H(e.x, e.z), e.z, .4, .4, 1.5, 1, .82, .3, e.hold > 0 ? .25 * (.5 + .5 * Math.sin(t * 8)) : 0, t);
  clp.end();
  if (!POOLS.jet) POOLS.jet = new Pool(MDL.jet, 6, MAT_I, true); const jp = POOLS.jet; jp.begin();
  for (let i = jets.length - 1; i >= 0; i--) { const j = jets[i]; const f = (nowS - j.t0) / j.dur; if (f >= 1) { jets.splice(i, 1); continue; } const x = lerp(j.sx, j.ex, f), z = lerp(j.sz, j.ez, f), yaw = Math.atan2(j.ex - j.sx, j.ez - j.sz); jp.add(x, 46, z, yaw, yaw, 1, .9, .9, .95, 0, 0); emit(pSmoke, x - Math.sin(yaw) * 5, 46, z - Math.cos(yaw) * 5, 0, 0, 0, 1, 1.5, 3.5, [.9, .9, .9, .4], [.9, .9, .9, 0], 1, 0); }
  jp.end();
  // markers
  let nm = 0;
  for (let i = markers.length - 1; i >= 0; i--) { const m = markers[i]; const f = (nowS - m.t0) / m.dur; if (f >= 1) { markers.splice(i, 1); continue; } if (nm < 16 && !m.ring) { const r = m.r ? m.r * (m.r > 5 ? Math.min(1, f * 3) : 1) : 2 * (1 - f) + .8; _m.makeScale(r, 1, r); _m.setPosition(m.x, M.H(m.x, m.z) + .3, m.z); markPool.setMatrixAt(nm++, _m); } }
  markPool.count = nm; markPool.instanceMatrix.needsUpdate = true;
  // 4.3 force field domes (always visible) and range circles for whatever is selected
  { const seenSh = new Set();
    for (const b of W.bld) {
      if (b.type !== 'shieldgen' || b.prog < 1 || b.dead || b.sp === undefined) continue; if (b.team !== MYTEAM && W.o.fog && !(b.sb >> MYTEAM & 1)) continue;
      seenSh.add(b.id); let m = SHDOME.get(b.id);
      if (!m) { if (!SHGEO) SHGEO = new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, PI / 2); m = new THREE.Mesh(SHGEO, new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: .15, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 4; worldGroup.add(m); SHDOME.set(b.id, m); }
      const R = b.sR || 28, f = clamp(b.sp / shieldMax(b), 0, 1); m.visible = !!b.sOn; m.position.set(b.x, M.H(b.x, b.z) - .6, b.z); m.scale.set(R, R * .5, R);
      m.material.opacity = .05 + .11 * f + (b.sFl > 0 ? .22 : 0); m.material.color.set(b.team === MYTEAM ? 0x6fd6ff : 0xff8a7a);
      if (b.sOn) { const n = 44; for (let k = 0; k < n; k++) { const a = k / n * TAU + t * .08; addRing(b.x + Math.cos(a) * R, b.z + Math.sin(a) * R, .32, b.team === MYTEAM ? .45 : 1, b.team === MYTEAM ? .85 : .5, b.team === MYTEAM ? 1 : .45); } }
    }
    for (const [id, m] of SHDOME) if (!seenSh.has(id)) { worldGroup.remove(m); m.material.dispose(); SHDOME.delete(id); }
    const addCircle = (x, z, R, cr, cg, cb) => { if (!(R > 0)) return; const n = clamp(Math.round(R * 1.15), 16, 120); for (let k = 0; k < n; k++) { const a = k / n * TAU; addRing(x + Math.cos(a) * R, z + Math.sin(a) * R, .4, cr, cg, cb); } };
    const unitCircles = (u, foe) => { const T = u.T; let R = 0, mn = 0; for (const w of [T.w, T.w2]) if (w) { R = Math.max(R, uRange(u, w)); if (w.minr) mn = Math.max(mn, w.minr); } const x = u.rx !== undefined ? u.rx : u.x, z = u.rz !== undefined ? u.rz : u.z; if (R) addCircle(x, z, R, foe ? 1 : 1, foe ? .35 : .85, foe ? .3 : .35); if (mn) addCircle(x, z, mn, 1, .3, .25); if (T.heal) addCircle(x, z, 11, .4, 1, .5); };
    let ni = 0; if (selIds.size <= 6) for (const id of selIds) { if (ni++ >= 6) break; const u = W.byId.get(id); if (u && !u.dead) unitCircles(u, false); }
    if (UI.selEnemy && !UI.selEnemy.dead && UI.selEnemy.k === 'u') unitCircles(UI.selEnemy, true);
    const sb = selBld ? W.byId.get(selBld) : null;
    if (sb && !sb.dead && sb.type !== 'wall') {
      const foe = sb.team !== MYTEAM, rg = foe ? [1, .35, .3] : [1, .85, .35];
      if (sb.w) { addCircle(sb.x, sb.z, sb.w.rng * (1 + P(sb.owner).mod.rng), rg[0], rg[1], rg[2]); if (sb.w.minr) addCircle(sb.x, sb.z, sb.w.minr, 1, .3, .25); }
      if (sb.type === 'radar' || sb.type === 'hq') addCircle(sb.x, sb.z, bVis(sb), .45, .7, 1);
      if (sb.type === 'medical') addCircle(sb.x, sb.z, 17, .4, 1, .5);
      if (sb.type === 'depot' && sb.spec === 'armory') addCircle(sb.x, sb.z, 45, 1, .6, .3);
      if (sb.type === 'radar' && sb.spec === 'jammer') addCircle(sb.x, sb.z, 55, 1, .4, .8);
      if (sb.type === 'shieldgen') addCircle(sb.x, sb.z, (sb.sR || 28) - .8, .6, .95, 1);
    }
  }
  // rings & bars
  rings.count = nr; rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true;
  barPool.geometry.instanceCount = nb; bars.ip.needsUpdate = true; bars.id.needsUpdate = true;
  // ambient weather
  updAtmos(dt, t);
  { const bn = M.bname; if (SET.particles >= 35 && W.wx.w === 'clear' && (bn === 'snow' || bn === 'desert' || bn === 'urban')) { const rate = (bn === 'snow' ? 26 : bn === 'desert' ? 10 : 6) * Math.min(1.5, SET.particles / 100); weatherAcc += rate * dt; const R = Math.min(75, cam.dist * .8); while (weatherAcc >= 1) { weatherAcc--; const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R, x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d; const gy = M.H(x, z);
    if (bn === 'snow') emit(pSmoke, x, gy + rr(8, 34), z, rr(-1, 1.5), rr(-3.2, -1.6), rr(-.6, .6), 6, .32, .26, [1, 1, 1, .85], [1, 1, 1, .3], 1, 0);
    else if (bn === 'desert') emit(pSmoke, x, gy + rr(.5, 7), z, rr(5, 9), rr(-.2, .4), rr(-1, 1), 3.5, .55, .9, [.86, .72, .5, .26], [.86, .72, .5, 0], .995, 0);
    else emit(pSmoke, x, gy + rr(10, 30), z, rr(-.6, .6), rr(-1.6, -.8), rr(-.6, .6), 7, .22, .2, [.55, .55, .55, .6], [.55, .55, .55, 0], 1, 0); } } }
  // particles
  updParticles(pSmoke, dt); updParticles(pFire, dt);
  // fog texture refresh
  fogT -= dt; if (fogT <= 0) { fogT = .2; updFogTex(); }
  renderer.render(scene, camera);
}
let HIDEPADS = false, selPad = null;
function setSelPadState(h, sp) { HIDEPADS = h; selPad = sp; }
function updFogTex() {
  if (!W.o.fog) { if (fogData[0] !== 255) { fogData.fill(255); fogTex.needsUpdate = true; } return; }
  const g = W.vis[MYTEAM]; for (let i = 0; i < g.length; i++) fogData[i] = g[i] === 2 ? 255 : g[i] === 1 ? 170 : 78; fogTex.needsUpdate = true;
}
// tracers: simple line segments
let trLines = null;
function drawTracers(dt) {
  if (!trLines) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 6), 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(160 * 6), 3).setUsage(THREE.DynamicDrawUsage)); trLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .95, depthWrite: false })); trLines.frustumCulled = false; trLines.renderOrder = 6; worldGroup.add(trLines); }
  const P_ = trLines.geometry.attributes.position.array, C_ = trLines.geometry.attributes.color.array; let n = 0;
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i]; tr.age += dt; if (tr.age >= tr.d) { tracers.splice(i, 1); continue; } if (n >= 160) continue;
    const f1 = Math.min(1, tr.age / tr.d * 1.15), f0 = Math.max(0, f1 - .38); const s = tr.s, t = tr.t, o = n * 6; const col = WK_COL[tr.k] || WK_COL[0];
    P_[o] = lerp(s[0], t[0], f0); P_[o + 1] = lerp(s[1], t[1], f0); P_[o + 2] = lerp(s[2], t[2], f0); P_[o + 3] = lerp(s[0], t[0], f1); P_[o + 4] = lerp(s[1], t[1], f1); P_[o + 5] = lerp(s[2], t[2], f1);
    C_[o] = col[0] * .5; C_[o + 1] = col[1] * .5; C_[o + 2] = col[2] * .5; C_[o + 3] = col[0]; C_[o + 4] = col[1]; C_[o + 5] = col[2]; n++;
  }
  trLines.geometry.setDrawRange(0, n * 2); trLines.geometry.attributes.position.needsUpdate = true; trLines.geometry.attributes.color.needsUpdate = true;
}

// ---------------- icons ----------------
function makeIcons() {
  const S = 80; const rt = new THREE.WebGLRenderTarget(S, S); const sc = new THREE.Scene(); const cm = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 2.6)); const dl = new THREE.DirectionalLight(0xffffff, 1.9); dl.position.set(3, 6, 4); sc.add(dl);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'); const buf = new Uint8Array(S * S * 4);
  const prev = renderer.getClearColor(new THREE.Color()); const pa = renderer.getClearAlpha(); renderer.setClearColor(0x000000, 0);
  const bake = (parts, key, ext, tilt) => {
    const grp = new THREE.Group(); const box = new THREE.Box3();
    for (const p of parts) { const g = p.geo.clone(); const col = g.attributes.color, acc = g.attributes.aAcc; for (let i = 0; i < col.count; i++) if (acc.getX(i) > .5) { const s = col.getX(i); col.setXYZ(i, s * .25, s * .55, s * 1.0); } const m = new THREE.Mesh(g, mat); if (p.mode !== 'body' && p.mode !== 'aim') m.position.set(p.ox, p.oy, p.oz); if (p.mode === 'rotor') m.rotation.y = .5; grp.add(m); }
    box.setFromObject(grp); const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()); const R = Math.max(sz.x, sz.y * 1.25, sz.z) * .62;
    grp.position.sub(c); grp.rotation.y = -.6; sc.add(grp); cm.left = -R; cm.right = R; cm.top = R; cm.bottom = -R; cm.position.set(0, R * 1.1, R * 1.9); cm.lookAt(0, -R * .12, 0); cm.updateProjectionMatrix();
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cm); renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf); renderer.setRenderTarget(null); sc.remove(grp);
    const id = cx.createImageData(S, S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const a = ((S - 1 - y) * S + x) * 4, b = (y * S + x) * 4; id.data[b] = buf[a]; id.data[b + 1] = buf[a + 1]; id.data[b + 2] = buf[a + 2]; id.data[b + 3] = buf[a + 3]; }
    cx.putImageData(id, 0, 0); ICONS[key] = cv.toDataURL('image/png'); grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  };
  try {
    for (const k of UTK) if (MDL[k]) bake(MDL[k], k);
    for (const k of BTK) { bake(bModel(k, 2, ''), 'b_' + k); bake(lgBModel(k, 2, ''), bIcon(k, 1)); }
  } catch (e) { console.warn('icon bake failed', e); }
  renderer.setClearColor(prev, pa); rt.dispose();
}

