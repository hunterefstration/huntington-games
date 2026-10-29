// ---------------- buildings ----------------
function updBuilding(b, dt) {
  const T = b.T, p = P(b.owner); if (b.flash > 0) b.flash -= dt; if (b.fire > 0) b.fire -= dt;
  if (b.prog < 1) {
    let n = 0; const out = tmpA; hashQ(b.x, b.z, 10, out); for (const e of out) if (e.team === b.team && e.T.eng) n++;
    const rate = dt / Math.max(3, T.bt[0]) * (1 + .5 * Math.min(3, n)) * (W.o.buildMul || 1); b.prog = Math.min(1, b.prog + rate); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * rate * .9);
    if (b.prog >= 1) { b.hp = Math.max(b.hp, b.maxHp * .5); p.stats.built++; ev([9, b.id, r1(b.x), r1(b.z)]); if (b.type === 'wall') { if (b.spec === 'mines') initMines(b); } }
    return;
  }
  if (b.upg) {
    let n = 0; if (b.upg.t === 0 || true) { const out = tmpA; hashQ(b.x, b.z, 10, out); for (const e of out) if (e.team === b.team && e.T.eng) n++; }
    b.upg.t += dt * (1 + .35 * Math.min(3, n));
    if (b.upg.t >= b.upg.dur) {
      if (b.upg.kind === 'lvl') { b.lvl++; refreshB(b); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * .2); if (b.type === 'hq') { p.popCap = p.popCap; } }
      else { b.spec = b.upg.spec; p.stats.specs++; if (b.type === 'hq') recalcMods(p); const old = b.maxHp; refreshB(b); b.hp += b.maxHp - old; if (b.type === 'wall' && b.spec === 'mines') initMines(b); }
      b.upg = null; ev([9, b.id, r1(b.x), r1(b.z)]); b.sb |= 0;
    }
  }
  if (p.selfRep && b.hp < b.maxHp && W.t - (b.hitT || -99) > 8) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * p.selfRep * dt);   // 3.0 Repair Crews perk
  // roster: train the next missing troop
  if (b.ros) rosterTick(b, dt);
  if (b.type === 'shieldgen') shieldTick(b, dt);
  // auras / specials every 0.5s
  b.aT -= dt; if (b.aT <= 0) { b.aT = .5; auraTick(b); }
  // weapons
  const w = b.w; if (w && b.prog >= 1) {
    if (b.cd > 0) b.cd -= dt;
    if ((b.scan -= dt) <= 0) {
      b.scan = .4 + Math.random() * .1; const rg = w.rng * (1 + p.mod.rng); let best = null, bs = -1e9; const out = tmpA; hashQ(b.x, b.z, rg, out);
      for (const e of out) { if (e.team === b.team || e.dead || !seen(b.team, e.x, e.z)) continue; if (effMult(w, e) < .18) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (w.minr && d < w.minr) continue; const s = scoreTarget({ type: b.type, T: { id: b.type }, x: b.x, z: b.z }, w, e, d); if (s > bs) { bs = s; best = e; } }
      b.tgt = best;
    }
    const t = b.tgt;
    if (t && !t.dead) {
      const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
      if (d > w.rng * (1 + p.mod.rng) + 3) b.tgt = null; else {
        b.aim = turnTo(b.aim, Math.atan2(dx, dz), 6, dt);
        if (b.cd <= 0 && Math.abs(angDiff(b.aim, Math.atan2(dx, dz))) < .25) bFire(b, w, t);
      }
    } else if (W.wx.night && SLT[b.type]) b.aim += dt * .45;   // 3.0 night: an idle tower sweeps its searchlight
  }
  // mines
  if (b.mines) { b.mineT -= dt; if (b.mineT <= 0) { b.mineT = .3; const out = tmpA; for (const m of b.mines) { if (m.t > 0) { m.t -= .3; continue; } hashQ(m.x, m.z, 1.9, out); for (const e of out) { if (e.team !== b.team && !e.T.air && !e.dead) { splashDmg(m.x, m.z, 4.5, 150, 'mine', b.team, b.owner, null, {}); ev([1, 2, r1(m.x), r1(W.M.H(m.x, m.z)), r1(m.z), 1]); m.t = 22; break; } } } } }
}
// 4.3 force fields: sp = shield points. Absorbs every hit inside the dome; at 0 it breaks, waits, recharges and comes back at half
function shieldMax(b) { return [1200, 2500, 4500][b.lvl - 1] * (b.spec === 'shard' ? 1.6 : 1); }
function shieldTick(b, dt) {
  const mx = shieldMax(b), rate = [60, 110, 180][b.lvl - 1] * (b.spec === 'sregen' ? 2.5 : 1); b.sR = 28 * (b.spec === 'swide' ? 1.5 : 1); if (b.sFl > 0) b.sFl -= dt;
  if (b.sp === undefined) { b.sp = mx; b.sOn = true; b.sHit = -99; b.sBrk = -99; }
  if (b.sp > mx) b.sp = mx;
  if (!b.sOn) { if (W.t - b.sBrk > (b.spec === 'sregen' ? 4 : 8)) { b.sp = Math.min(mx, b.sp + rate * dt); if (b.sp >= mx * .5) { b.sOn = true; ev([9, b.id, r1(b.x), r1(b.z)]); } } }
  else if (W.t - b.sHit > 5 && b.sp < mx) b.sp = Math.min(mx, b.sp + rate * dt);
}
function bFire(b, w, t) {
  b.cd = w.cd * (.95 + Math.random() * .1); b.fire = .2; b.nShot = (b.nShot | 0) + 1; const p = P(b.owner);
  const sy = b.y + b.sz * .6, dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz); const ty = t.y + (t.T.air ? 0 : 1);
  let dmg = w.dmg * (b.type === 'hq' ? 1 : 1) * (1 + p.mod.dmgBul * (w.wt === 'bullet' ? 1 : 0) + p.mod.dmgAT * (w.wt === 'cannon' ? 1 : 0) + p.mod.dmgShell * (w.wt === 'shell' ? 1 : 0));
  if (w.ps > 0) {
    const dur = Math.max(.12, d / w.ps + (w.arc ? .5 : 0));
    let tx = t.x + (t.vx || 0) * dur * .8, tz = t.z + (t.vz || 0) * dur * .8;
    for (let s = 0; s < w.shots; s++) {
      let ex = tx, ez = tz; if (w.scat) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * w.scat; ex += Math.cos(a) * r; ez += Math.sin(a) * r; } else if (w.arc) { const a = Math.random() * TAU, r = d * .015 * Math.random(); ex += Math.cos(a) * r; ez += Math.sin(a) * r; }
      const dd = dur + s * .08, pr = { sx: b.x, sy, sz: b.z, tx: ex, ty: w.arc ? W.M.H(ex, ez) : ty, tz: ez, t0: W.t, dur: dd, src: null, owner: b.owner, team: b.team, dmg, wt: w.wt, spl: w.spl * (1 + p.mod.spl), tid: t.id, arc: w.arc, k: w.k, shock: w.shock };
      W.proj.push(pr); ev([0, w.k, r1(b.x), r1(sy), r1(b.z), r1(ex), r1(pr.ty), r1(ez), r1(dd), b.id, w.arc ? 1 : 0]);
    }
  } else if (w.chain) {   // 4.2 Tesla: the bolt jumps to the nearest enemies around the first target
    const out = []; hashQ(t.x, t.z, 9, out); const hits = [t]; out.sort((a, c) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(c.x - t.x, c.z - t.z));
    for (const e of out) { if (hits.length >= w.chain) break; if (e === t || e.dead || e.team === b.team || !seen(b.team, e.x, e.z)) continue; hits.push(e); }
    let px = b.x, py = sy, pz = b.z; for (const e of hits) { const ey = e.y + (e.T.air ? 0 : 1); ev([0, 5, r1(px), r1(py), r1(pz), r1(e.x), r1(ey), r1(e.z), 0, b.id, 0]); hurt(e, dmg, 'tesla', null, b.owner, { shock: w.shock }); px = e.x; py = ey; pz = e.z; }
  } else {
    const hit = Math.random() < clamp(1.05 - d / w.rng * .4, .55, 1);
    if (w.wt === 'flak') splashDmg(t.x, t.z, Math.max(w.spl, 1.5), dmg, w.wt, b.team, b.owner, null, { hitAir: 1 }); else if (hit) hurt(t, dmg, w.wt, null, b.owner);
    ev([0, w.k, r1(b.x), r1(sy), r1(b.z), r1(t.x + (hit ? 0 : rr(-2, 2))), r1(ty), r1(t.z + (hit ? 0 : rr(-2, 2))), 0, b.id, 0]);
  }
}
function auraTick(b) {
  const out = []; const p = P(b.owner);
  if (b.type === 'medical') {
    const heal = [5, 8, 12][b.lvl - 1] * (b.spec === 'triage' ? 2 : 1) * (1 + p.mod.heal); hashQ(b.x, b.z, 17, out);
    for (const e of out) { if (e.team !== b.team) continue; if (e.T.cls === 0 || b.spec === 'motor') { if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + heal * .5); } if (b.spec === 'stim' && e.T.cls === 0) e.stimT = .7; if (b.spec === 'triage' && e.T.cls === 0) e.triT = .7; }
  }
  else if (b.type === 'shipyard' && b.prog >= 1) { const amt = [8, 12, 16][b.lvl - 1] * (b.spec === 'drydock' ? 2 : 1); hashQ(b.x, b.z, 28, out); for (const e of out) if (e.team === b.team && e.T.naval && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + amt); }   // 3.0 ships are repaired at their Shipyard
  else if (b.type === 'radar' && b.spec === 'jammer') { hashQ(b.x, b.z, 55, out); for (const e of out) if (e.team !== b.team) e.jamT = .7; }
  else if (b.type === 'depot' && b.spec === 'armory') { hashQ(b.x, b.z, 45, out); for (const e of out) if (e.team === b.team) e.armT = .7; }
  else if (b.type === 'wall' && b.spec === 'wire') {
    const pt = W.pts[b.pt]; hashQ(pt.x, pt.z, pt.big ? 38 : pt.hq >= 0 ? 21 : 16, out); for (const e of out) { if (e.team === b.team || e.T.air || e.T.cls !== 0) continue; const d = Math.hypot(e.x - pt.x, e.z - pt.z); if (d > (pt.big ? 33.5 : pt.hq >= 0 ? 17 : 11.5)) { e.slow = Math.max(e.slow, .7); hurt(e, 3, 'bullet', null, b.owner); } }
  }
  if (b.type === 'wall') { const pt = W.pts[b.pt]; const red = BT.wall.red[b.lvl - 1] + (b.spec === 'bulwark' ? .1 : 0); hashQ(pt.x, pt.z, pt.big ? 38 : pt.hq >= 0 ? 21 : 15, out); for (const e of out) if (e.team === b.team) { e.wr = red; e.wrT = .7; } }
}
function spawnFromBuilding(b, type, idx) {
  const T = UT[type], p = P(b.owner), M = W.M;
  const dest = b.hasRally ? [b.rx, b.rz] : null;   // 4.3: no rally point = new troops wait next to the building
  let ang = dest ? Math.atan2(dest[1] - b.z, dest[0] - b.x) : Math.atan2(-b.z, -b.x) + (Math.random() - .5) * 1.2;
  ang += (idx || 0) * .8 - ((b.id * 7) % 5) * .15; const d = b.sz * .5 + 2.6 + (T.cls >= 1 ? 1.5 : 0);
  let x = b.x + Math.cos(ang) * d, z = b.z + Math.sin(ang) * d; const q = snapFree(M, x, z, 5); x = q[0]; z = q[1];
  if (T.naval) {   // 3.0 ships launch on the water side, spread out along the way out of the dock
    const sl = b.pt >= 0 && b.slot >= 0 && W.pts[b.pt] ? W.pts[b.pt].slots[b.slot] : null, bx = sl && sl.wx !== undefined ? sl.wx : b.x, bz = sl && sl.wz !== undefined ? sl.wz : b.z, k = b.nShip = ((b.nShip | 0) + 1) % 6;
    let dx = bx - b.x, dz = bz - b.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; const f = 3 + (k >> 1) * 5, sd = (k & 1 ? 1 : -1) * 3.5;
    const w = snapWater(M, bx + dx * f - dz * sd, bz + dz * f + dx * sd, 30) || [bx, bz]; x = w[0] + (Math.random() - .5) * .6; z = w[1] + (Math.random() - .5) * .6; ang = Math.atan2(dx, dz);
  }
  const o = { rot: ang }; if (b.spec === 'elite' && T.cls === 0) o.vet = 1; if (b.spec === 'shock' && T.cls === 0) { o.hpB = 1.2; o.spB = 1.1; o.dmB = 1.1; } if (b.spec === 'heavy' && (T.cls === 1 || T.cls === 2)) o.hpB = 1.15; if (b.spec === 'drydock') o.hpB = 1.2;
  const u = spawnUnit(type, b.owner, x, z, o); u.home = b.id; u.ghost = 3; if (o.vet) refreshUnit(u), u.hp = u.maxHp;
  if (b.type === 'factory' && b.spec === 'artillery' && (T.eq || type) === 'artillery') u.fromArtPark = true;
  if (b.spec === 'gunnery') u.rngB = 1.15;
  if (b.hasRally) { u.o = 1; u.tx = b.rx; u.tz = b.rz; u.arr = 3; if (T.naval) { const w = snapWater(M, b.rx, b.rz, 70); if (w) { u.tx = w[0]; u.tz = w[1]; } else u.o = 0; } }
  return u;
}

// ---------------- world tick ----------------
function simTick() {
  const dt = TICK; if (W.over && !W.o.sandbox) { }
  W.tick++; W.t += dt; hashBuild(); countHomes(); FIELD_BUDGET = 3; FIELD_BANK = Math.min(4, FIELD_BANK + FIELD_MS); W.shl = W.bld.filter(b => b.type === 'shieldgen' && b.prog >= 1 && b.sOn && !b.dead);
  const us = W.units;
  for (let i = 0; i < us.length; i++) { const u = us[i]; if (!u.dead) { updUnit(u, dt); } }
  // separation after movement (hash is slightly stale: ok)
  sepBuild(); for (let i = 0; i < us.length; i++) separate(us[i], dt);
  for (let i = W.bld.length - 1; i >= 0; i--) { const b = W.bld[i]; if (!b.dead) updBuilding(b, dt); }
  // projectiles
  for (let i = W.proj.length - 1; i >= 0; i--) { const pr = W.proj[i]; if (W.t >= pr.t0 + pr.dur) { W.proj[i] = W.proj[W.proj.length - 1]; W.proj.pop(); impact(pr); } }
  // scheduled
  for (let i = W.sched.length - 1; i >= 0; i--) { const s = W.sched[i]; if (W.t >= s.at) { W.sched.splice(i, 1); s.fn(); } }
  for (let i = W.reveals.length - 1; i >= 0; i--) { W.reveals[i].t -= dt; if (W.reveals[i].t <= 0) W.reveals.splice(i, 1); }
  if (W.tick % 4 === 0) capTick(dt * 4);
  if (W.tick % 5 === 0) updateVision();
  if (W.tick % 10 === 0) slowTick();
  if (W.tick % 20 === 0) secTick();
  for (const p of W.players) {
    if (p.ai && p.alive) p.ai.update(dt);
    if (p.res) { p.res.t += dt; if (p.res.t >= p.res.dur) { p.techs[p.res.id] = 1; const nm = TECHBY[p.res.id].n; p.res = null; recalcMods(p); ev([3, p.id, 'tech', 0, 0, 0, nm]); } }
    for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] -= dt;
    p.sup += p.inc * dt; p.stats.sup += p.inc * dt; if (W.o.sandbox && p.id === ME) p.sup = Math.max(p.sup, 99999);
  }
}
function slowTick() {
  const M = W.M, n = M.nav;
  for (const u of W.units) { u.cov = u.T.air ? 0 : n.cover[n.idx(u.x, u.z)]; }
}
// 4.1: the army limit. Flags and HQ levels raise it, and so does every Supply Depot (3 / 6 / 10 by level). Endless War allows much bigger armies.
function popCapOf(p) {
  let pn = 0, dep = 0; for (const pt of W.pts) if (pt.owner === p.id) pn++; for (const b of W.bld) if (b.owner === p.id && b.type === 'depot' && b.prog >= 1) dep += [3, 6, 10][b.lvl - 1];
  if (W.o.war) return Infinity;   // 4.3: Endless War has no army limit at all
  const hqL = p.hqB ? p.hqB.lvl : 1; const base = W.o.war ? 50 + pn * 8 + (hqL - 1) * 30 : 36 + pn * 7 + (hqL - 1) * 10;
  return Math.min(W.popMax, base + dep + p.mod.pop);
}
function secTick() {
  for (const p of W.players) {
    if (!p.alive) { p.inc = 0; continue; }
    let inc = 0, pn = 0; for (const pt of W.pts) if (pt.owner === p.id) { pn++; inc += pt.hq >= 0 ? 6 : 3 * pt.val; }
    for (const b of W.bld) if (b.owner === p.id && b.type === 'depot' && b.prog >= 1) inc += BT.depot.inc[b.lvl - 1] * (b.spec === 'trade' ? 1.6 : 1);
    for (const b of W.bld) if (b.owner === p.id && b.type === 'farm' && b.prog >= 1 && !b.dead) { b.ripe = Math.min(180, (b.ripe || 0) + 1); inc += BT.farm.inc[b.lvl - 1] * (1 + .5 * b.ripe / 180); }
    let hqL = p.hqB ? p.hqB.lvl : 1; inc *= 1 + (hqL - 1) * .12;
    inc *= 1 + p.mod.inc; if (p.ai) inc *= p.ai.dif.inc; p.inc = inc; p.ptsN = pn; p.stats.peakPts = Math.max(p.stats.peakPts, pn);
    p.popCap = popCapOf(p);
    if (p.hqB && p.hqB.dead && p.alive) p.alive = false;
    if (W.o.war && p.id === 1) p.popCap = Math.max(p.popCap, 200);
  }
  if (W.tick % 60 === 0) bleedTick();
  fevTick(); objTick(); if (W.o.war) warTick();
  checkWin();
}
function bleedTick() {
  if (W.o.sandbox || W.o.war || W.over) return; const cnt = {}; let total = 0;
  for (const t of W.teamList) cnt[t.id] = 0; for (const pt of W.pts) if (pt.owner >= 0) { cnt[P(pt.owner).team] = (cnt[P(pt.owner).team] || 0) + 1; total++; }
  let mx = 0; for (const t of W.teamList) if (t.alive) mx = Math.max(mx, cnt[t.id]);
  for (const t of W.teamList) { if (!t.alive) continue; const diff = mx - cnt[t.id]; if (diff > 0) t.tickets -= Math.ceil(diff / 2) * (W.o.bleed || 1); }
  checkWin();
}
function capTick(dt) {
  const out = tmpA;
  for (const pt of W.pts) {
    pt.cnt[0] = pt.cnt[1] = pt.cnt[2] = pt.cnt[3] = 0; const str = {};
    hashQ(pt.x, pt.z, pt.r, out);
    for (const u of out) { if (u.dead || !u.T.cap) continue; const wgt = u.T.eng ? 1.6 : 1; pt.cnt[u.team] += wgt; str[u.owner] = (str[u.owner] || 0) + wgt; }
    let teams = 0, T = -1; for (let t = 0; t < 4; t++) if (pt.cnt[t] > 0) { teams++; T = t; }
    pt.contested = teams > 1;
    if (pt.hq >= 0) continue;
    const ownT = pt.owner >= 0 ? P(pt.owner).team : -1;
    if (teams === 1) {
      const n = pt.cnt[T]; const rate = (.07 + Math.min(n, 7) * .045) * dt * (W.o.capSpeed || 1);
      let bp = -1, bv = 0; for (const k in str) if (P(+k).team === T && str[k] > bv) { bv = str[k]; bp = +k; }
      if (ownT === T) { pt.ctrl = Math.min(1, pt.ctrl + rate); }
      else if (pt.owner >= 0) { pt.ctrl -= rate; { const kk = 'p' + pt.id; if (W.t - (W.alertT[kk] || -99) > 12 && P(pt.owner).kind !== 'ai') { W.alertT[kk] = W.t; alertMsg(pt.owner, 'attack', pt.x, pt.z, 0, 'Point ' + pt.name); } } if (pt.ctrl <= 0) { const prev = pt.owner; razePoint(pt); pt.owner = -1; pt.ctrl = 0; pt.capP = bp; ev([7, pt.id, -1, T, prev]); } }
      else {
        const capT = pt.capP >= 0 ? P(pt.capP).team : -1;
        if (capT !== T && pt.ctrl > 0) { pt.ctrl -= rate; if (pt.ctrl <= 0) { pt.ctrl = 0; pt.capP = bp; } }
        else { pt.capP = pt.capP >= 0 && capT === T ? pt.capP : bp; pt.ctrl += rate; if (pt.ctrl >= 1) { pt.ctrl = 1; pt.owner = pt.capP; P(pt.owner).stats.captured++; if (pt.coast && W.M.naval && P(pt.owner).hqB && pt.comp !== W.pts[P(pt.owner).hqB.pt].comp) P(pt.owner).stats.isle = 1; ev([7, pt.id, pt.owner, T, -1]); pt.flash = 1.5; } }
      }
    } else if (teams === 0) {
      if (pt.owner >= 0 && pt.ctrl < 1) pt.ctrl = Math.min(1, pt.ctrl + .03 * dt); else if (pt.owner < 0 && pt.ctrl > 0) pt.ctrl = Math.max(0, pt.ctrl - .02 * dt);
    }
    if (pt.flash > 0) pt.flash -= dt;
  }
}
function razePoint(pt) {
  for (const sl of pt.slots) if (sl.b) { const b = sl.b; ev([1, 2, r1(b.x), r1(b.y + 1), r1(b.z), 0]); killBuilding(b, null, -1); P(b.owner).stats.lost++; }
  if (pt.wall) killBuilding(pt.wall, null, -1);
  for (const b of W.bld.slice()) if (b.type === 'nest') { if (Math.hypot(b.x - pt.x, b.z - pt.z) < 12 && b.owner === pt.owner) killBuilding(b, null, -1); }
}

// ---------------- 3.0 field events (offline battles): supply crates, enemy aces, artillery strikes ----------------
// A crate is claimed by the side that keeps troops next to it, alone, for 5 seconds. An ace is a marked unit with extra health
// and a bounty on it. An artillery strike shells a busy flag after a 12 second warning, hitting everyone there.
function fevMsg(text, x, z, col, teamOnly) { for (const q of W.players) if ((q.kind === 'human' || q.kind === 'remote') && (teamOnly === undefined || q.team === teamOnly)) ev([3, q.id, 'msg', r1(x || 0), r1(z || 0), col || 0, text]); }
function teamName(t) { for (const q of W.players) if (q.team === t && (q.kind === 'human' || q.kind === 'remote')) return 'Your side'; return 'The enemy'; }
function humanTeam() { for (const q of W.players) if (q.kind === 'human') return q.team; return -1; }
function fevReward(team, amt, x, z, crate) {   // goes to whoever on that side has the most troops there
  const ps = W.players.filter(q => q.team === team && q.alive); if (!ps.length) return 0; let best = ps[0], bn = -1;
  for (const q of ps) { let n = 0; for (const u of W.units) if (u.owner === q.id && Math.hypot(u.x - x, u.z - z) < 14) n++; if (n > bn) { bn = n; best = q; } }
  const a = Math.round(amt * (best.fevMul || 1)); best.sup += a; if (crate) best.stats.crates = (best.stats.crates || 0) + 1; return a;
}
function fevSpawn() {
  const supplyGame = W.o.obj && W.o.obj.type === 'supply';
  const kinds = supplyGame ? ['crate'] : ['crate', 'crate', 'ace', 'strike'];
  let k = kinds[(Math.random() * kinds.length) | 0]; if (W.fev.some(e => e.k === k) && !supplyGame) k = kinds.find(x => !W.fev.some(e => e.k === x)) || null; if (!k) return;
  if (k === 'crate') {
    // a fair spot: one of the flags that are about as far from every side's HQ (so nobody gets it for free)
    const hqs = W.teamList.filter(t => t.alive).map(t => W.players.filter(q => q.team === t.id && q.alive && q.hqB).map(q => q.hqB));
    const spread = q => { const ds = hqs.map(hs => Math.min(...hs.map(h => Math.hypot(h.x - q.x, h.z - q.z)))); return Math.max(...ds) - Math.min(...ds); };
    const cand = W.pts.filter(q => q.hq < 0).map(q => [q, spread(q) + Math.random() * 12]).sort((a, b) => a[1] - b[1]).slice(0, 3); const pt = cand.length ? cand[(Math.random() * cand.length) | 0][0] : null;
    const a = Math.random() * TAU, d = pt ? rr(9, 16) : rr(0, 20); const q = snapFree(W.M, (pt ? pt.x : 0) + Math.cos(a) * d, (pt ? pt.z : 0) + Math.sin(a) * d, 6);
    const e = { k, id: ++W.fevN, x: q[0], z: q[1], t: 0, life: 100, hold: 0, ht: -1, land: 3 };
    W.fev.push(e); ev([5, 1, r1(e.x), r1(e.z), 3, 1]);
    fevMsg('Supply crate dropping' + (pt ? ' near ' + pt.name : '') + '! Keep troops next to it to claim ' + (supplyGame ? 'it.' : '350 money.'), e.x, e.z, 1);
  } else if (k === 'ace') {
    const teams = W.teamList.filter(t => t.alive).map(t => t.id); const tm = teams[(W.fevN + (Math.random() < .5 ? 0 : 1)) % teams.length];
    let best = null, bs = 0; for (const u of W.units) { if (u.team !== tm || u.T.air || !u.T.w || u.life > 0 || u.ace) continue; const sc = u.T.cost * (1 + u.vet * .3); if (sc > bs) { bs = sc; best = u; } }
    if (!best) return; const e = { k, id: ++W.fevN, uid: best.id, team: tm, x: best.x, z: best.z, t: 0, life: 150 };
    best.ace = 1; best.hpB *= 1.5; best.dmB *= 1.2; refreshUnit(best); best.hp = best.maxHp; W.fev.push(e);
    for (const q of W.players) if (q.kind === 'human' || q.kind === 'remote') ev([3, q.id, 'msg', r1(best.x), r1(best.z), 2, q.team === tm ? 'Your ' + best.T.n + ' is now an Ace: +50% health, +20% damage. Keep it alive for 2:30 for a 200 bonus. The enemy has a bounty on it!' : 'Enemy Ace spotted: ' + (/^[AEIOU]/.test(best.T.n) ? 'an ' : 'a ') + best.T.n + ' (gold ring). Destroy it for a 300 bounty!']);
  } else if (k === 'strike') {
    let best = null, bs = 0; for (const pt of W.pts) { if (pt.hq >= 0) continue; const out = []; hashQ(pt.x, pt.z, 20, out); const tm = new Set(out.map(u => u.team)); const sc = out.length * (tm.size > 1 ? 2 : 1); if (sc > bs) { bs = sc; best = pt; } }
    if (!best || bs < 4) return; const e = { k, id: ++W.fevN, x: best.x, z: best.z, t: 0, life: 12, r: 17 };
    W.fev.push(e); fevMsg('Artillery strike on ' + best.name + ' in 12 seconds! It hits everyone there. Get your troops out (or lure the enemy in).', e.x, e.z, 3);
  }
}
function fevTick() {      // once a second
  if (!W.fev || (W.war && W.war.phase !== 'fight')) return; const obj = W.o.obj;
  if (!W.over && W.t >= W.fevT) { W.fevT = W.t + (obj && obj.type === 'supply' ? rr(45, 60) : rr(110, 160)); fevSpawn(); }
  for (let i = W.fev.length - 1; i >= 0; i--) {
    const e = W.fev[i]; e.t++; let done = false;
    if (e.k === 'crate') {
      if (e.t < e.land) continue;
      const out = []; hashQ(e.x, e.z, 7, out); const tm = new Set(); for (const u of out) if (!u.dead && !u.T.air && u.life <= 0) tm.add(u.team);
      if (tm.size === 1) { const t = [...tm][0]; if (t !== e.ht) { e.ht = t; e.hold = 0; } e.hold++; } else if (tm.size === 0) e.hold = Math.max(0, e.hold - 1);
      if (e.hold >= 5) {
        done = true; const t = e.ht; ev([6, r1(e.x), r1(e.z), 12, 2, -1]);
        for (const u of W.units) if (u.team === t && Math.hypot(u.x - e.x, u.z - e.z) < 14) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .5);
        if (obj && obj.type === 'supply') { W.objC[t] = (W.objC[t] || 0) + 1; fevMsg(teamName(t) + ' claimed a supply crate (' + W.objC[t] + '/' + obj.need + ').', e.x, e.z, 1); fevReward(t, 150, e.x, e.z, 1); }
        else { const a = fevReward(t, 350, e.x, e.z, 1); fevMsg(teamName(t) + ' claimed the supply crate (+' + a + ' money, troops healed).', e.x, e.z, 1); }
      } else if (e.t >= e.life) { done = true; fevMsg('The supply crate was lost.', e.x, e.z, 0); }
    } else if (e.k === 'ace') {
      const u = W.byId.get(e.uid); if (u && !u.dead) { e.x = u.x; e.z = u.z; }
      if (!u || u.dead) done = true;
      else if (e.t >= e.life) { done = true; u.ace = 0; const a = fevReward(e.team, 200, u.x, u.z); fevMsg((teamName(e.team) === 'Your side' ? 'Your' : 'The enemy') + ' Ace survived (+' + a + ' money).', u.x, u.z, 2); }
    } else if (e.k === 'strike') {
      if (e.t >= e.life) { done = true; const x = e.x, z = e.z, M = W.M;
        for (let j = 0; j < 14; j++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * e.r, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r; W.sched.push({ at: W.t + .3 + j * .4, fn: () => { const pr = { sx: bx + 30, sy: 70, sz: bz + 30, tx: bx, ty: M.H(bx, bz), tz: bz, t0: W.t, dur: 1.4, src: null, owner: -1, team: -1, dmg: 70, wt: 'shell', spl: 6, tid: 0, arc: 1, k: 2 }; W.proj.push(pr); ev([0, 2, r1(pr.sx), 70, r1(pr.sz), r1(bx), r1(pr.ty), r1(bz), 1.4, 0, 1]); } }); }
        ev([6, r1(x), r1(z), e.r, 1, -1]); }
    }
    if (done) W.fev.splice(i, 1);
  }
}
// ace killed: the killer's side collects the bounty
function aceKilled(u, owner) {
  if (owner === undefined || owner < 0 || !W.players[owner]) return; const k = W.players[owner]; if (k.team === u.team) return;
  const a = Math.round(300 * (k.fevMul || 1)); k.sup += a; k.stats.aces = (k.stats.aces || 0) + 1; fevMsg(teamName(k.team) + ' destroyed ' + (teamName(u.team) === 'Your side' ? 'your' : 'the enemy') + ' Ace ' + u.T.n + ' (+' + a + ' bounty).', u.x, u.z, 2);
}
// ---------------- 3.0 battle objectives (Campaign missions) ----------------
function endBattle(team, reason) { if (W.over) return; W.over = true; W.winner = team; W.reason = reason; for (const t of W.teamList) if (t.id !== team) { t.alive = false; for (const i of t.players) { const q = W.players[i]; if (q.alive) { q.alive = false; q.out = reason; } } } ev([12, team, reason]); }
function objTick() {
  const o = W.o.obj; if (!o || W.over || W.o.sandbox) return; const ht = humanTeam(); const foe = W.teamList.find(t => t.id !== ht);
  if (o.type === 'blitz' && W.t >= o.dur) endBattle(foe ? foe.id : -1, 'Out of time');
  else if (o.type === 'holdout' && W.t >= o.dur) endBattle(ht, 'You held out');
  else if (o.type === 'koth') { const pt = W.pts[o.pt]; if (pt && W.t >= (o.open || 0) && pt.owner >= 0 && pt.ctrl >= 1 && !pt.contested) { const t = P(pt.owner).team; W.objC[t] = (W.objC[t] || 0) + 1; if (W.objC[t] >= o.need) endBattle(t, t === ht ? 'You held the hill' : 'The enemy held the hill'); } }
  else if (o.type === 'supply') { for (const t in W.objC) if (W.objC[t] >= o.need) { endBattle(+t, +t === ht ? 'You grabbed the supplies' : 'The enemy grabbed the supplies'); break; } }
}
// 3.0: change the battle conditions in the middle of a battle (Endless War night and storm waves)
function setWeather(tod, weather) { W.o.tod = tod; W.o.weather = weather; W.wx = wxOf(W.o); W.wxVer = (W.wxVer | 0) + 1; W.o.fog = W.wx.fog && !W.o.demo ? true : !!W.o.fogBase; if (W.o.fog) { updateVision(); updateVision(); } }
// 3.0 campaign setup: Doctrines for the player and the mission's starting conditions
function battleSetup() {
  const o = W.o; W.fev = []; W.fevN = 0; W.objC = {}; W.fevT = o.events ? (o.obj && o.obj.type === 'supply' ? 35 : rr(100, 130)) : 1e9;
  if (o.obj && o.obj.type === 'koth' && o.obj.pt === undefined) { let best = null; for (const pt of W.pts) if (pt.hq < 0 && (!best || pt.val > best.val || (pt.val === best.val && Math.hypot(pt.x, pt.z) < Math.hypot(best.x, best.z)))) best = pt; o.obj.pt = best ? best.id : 0; }
  if (W.mirror) return;
  for (const p of W.players) {
    const s = o.players[p.id]; const hq = p.hqB; if (!hq) continue; const pt = W.pts[hq.pt];
    const near = n => { const a = Math.atan2(-pt.z, -pt.x) + rr(-.6, .6), d = 14 + rr(0, 6); return snapFree(W.M, pt.x + Math.cos(a) * d, pt.z + Math.sin(a) * d, 5); };
    const add = (t, n, vet) => { for (let i = 0; i < n; i++) { const q = near(); spawnUnit(t, p.id, q[0], q[1], { rot: Math.atan2(-pt.z, -pt.x), vet: vet || 0 }); } };
    if (s.extra) for (const [t, n] of s.extra) add(fu(p, t), n);
    if (s.sup) p.sup += s.sup;
    if (s.fort) {   // dug in: walls at the HQ and the home flag, bunkers at the flags it holds
      placeBuilding('wall', p.id, pt, -2, true).slot = -2;
      for (const q of W.pts) if (q.owner === p.id && q.hq < 0) { if (!q.wall) placeBuilding('wall', p.id, q, -2, true).slot = -2; const k = q.slots.findIndex(x => !x.b); if (k >= 0) { const b = placeBuilding('turret', p.id, q, k, true); b.lvl = 2; refreshB(b); b.hp = b.maxHp; } }
      for (let n = 0; n < 2; n++) { const k = pt.slots.findIndex(x => !x.b); if (k >= 0) { const b = placeBuilding('turret', p.id, pt, k, true); b.lvl = 2; refreshB(b); b.hp = b.maxHp; } }
    }
    const G = !o.mp && p.kind === 'human' && s.gen ? s.gen : null; if (!s.docs && !G) continue; const D = s.docs || {}, has = id => D[id] || 0, gr = id => G && G[id] || 0;   // 3.0: General perks (never online)
    p.gen = G; p.perkMod = perkModOf(D, G); p.bldDisc = .08 * gr('contract'); p.selfRep = .01 * gr('repair');
    p.sup += 300 * has('chest') + 150 * gr('funds'); p.bounty = (has('bounty') ? .15 : 0) + (gr('spoils') ? .1 : 0); p.fevMul = has('qm') ? 2 : 1;
    if (has('hq2')) { hq.lvl = 2; refreshB(hq); hq.hp = hq.maxHp; }
    if ((has('fort') || gr('dugin')) && !pt.wall) { const w = placeBuilding('wall', p.id, pt, -2, true); w.slot = -2; w.spent = 0; }   // a free wall: selling it gives nothing back
    if (gr('spear')) add(fu(p, 'lighttank'), 2);
    if (has('base')) { const k = pt.slots.findIndex(x => !x.b); if (k >= 0) { const b = placeBuilding('barracks', p.id, pt, k, true); b.ros[fu(p, 'rifleman')] = 3; b.ros[fu(p, 'rocket')] = 2; } }
    if (has('vets')) { for (const u of W.units) if (u.owner === p.id) { u.vet = Math.max(u.vet, 1); refreshUnit(u); u.hp = u.maxHp; } add(fu(p, 'rifleman'), 3, 1); }
    if (has('tanks')) add(fu(p, 'lighttank'), 2 * has('tanks'));
    if (has('mercs')) { for (let i = 0; i < 4; i++) { const q = near(); const u = spawnUnit('merc', p.id, q[0], q[1], { vet: 1, life: 180 }); refreshUnit(u); u.hp = u.maxHp; } }
    recalcMods(p);
  }
}
