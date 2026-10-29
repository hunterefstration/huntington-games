// ---------------- spawning ----------------
function spawnUnit(type, owner, x, z, o) {
  o = o || {}; const T = UT[type], p = W.players[owner];
  const u = { id: W.nid++, k: 'u', type, T, owner, team: p.team, x, z, y: 0, px: x, pz: z, rot: o.rot || 0, prot: o.rot || 0, aim: o.rot || 0, paim: o.rot || 0, hp: 0, maxHp: 0, vet: o.vet || 0, xp: 0, o: 0, tx: 0, tz: 0, tid: 0, tgt: null, scan: Math.random() * .4, cd1: Math.random() * .6, cd2: Math.random() * .6, slow: 0, vx: 0, vz: 0, hpB: 1, dmB: 1, spB: 1, life: o.life || 0, moving: false, flash: 0, shield: 0, stuck: 0, am: false, spdCap: 0, arr: 2, los: false, losT: 0, cov: 0, wr: 0, wrT: 0, stimT: 0, triT: 0, armT: 0, jamT: 0, dead: false, anchorX: x, anchorZ: z, firing: 0, rx: x, rz: z, ry: 0, rrot: 0, raim: 0, hpf: 1, healT: 0 };
  if (o.hpB) u.hpB = o.hpB; if (o.dmB) u.dmB = o.dmB; if (o.spB) u.spB = o.spB;
  refreshUnit(u); u.hp = u.maxHp;
  u.y = T.naval ? W.M.wl : W.M.H(x, z) + (T.air ? T.alt : 0);
  W.units.push(u); W.byId.set(u.id, u); p.pop += T.pop;
  return u;
}
function placeBuilding(type, owner, pt, slot, instant) {
  const T = BT[type], p = P(owner); let x, z;
  if (type === 'wall') { x = pt.x; z = pt.z; } else if (slot >= 0) { x = pt.slots[slot].x; z = pt.slots[slot].z; } else { x = pt.x; z = pt.z; }
  const b = { id: W.nid++, k: 'b', type, T, owner, team: p.team, pt: pt ? pt.id : -1, slot, x, z, y: W.M.H(x, z), lvl: 1, spec: '', hp: 0, maxHp: 0, prog: instant ? 1 : 0, upg: null, ros: T.ros ? {} : null, have: T.ros ? {} : null, made: {}, paid: {}, tr: null, wait: 0, hold: false, rx: 0, rz: 0, hasRally: false, cd: 0, cd2: 0, scan: Math.random(), tgt: null, aim: 0, flash: 0, dead: false, spent: T.cost[0], w: null, sb: 1 << p.team, aT: 0, mines: null, mineT: 0, sz: T.sz, rot: 0, fire: 0 };
  refreshB(b); b.hp = instant ? b.maxHp : b.maxHp * .12;
  if (type === 'hq') { b.rot = Math.atan2(-z, -x) + PI / 2; }
  else if (slot >= 0 && pt.slots[slot].sea) { const sl = pt.slots[slot]; b.rot = Math.atan2(sl.wx - x, sl.wz - z); b.y = Math.max(b.y, W.M.wl); }   // 3.0: the Shipyard's pier points at the water
  else { b.rot = Math.atan2(W.M.hd * .0 - z, -x) + (slot >= 0 ? 0 : 0); b.rot = Math.round(Math.atan2(-x, -z) / (PI / 2)) * (PI / 2); }
  W.bld.push(b); W.byId.set(b.id, b);
  if (type === 'wall') { pt.wall = b; b.arcs = []; const arcs = wallArcs(pt); for (const a of arcs) for (let t = a[0]; t <= a[1]; t += 1.1 / a[2]) { const wx = pt.x + Math.cos(t) * a[2], wz = pt.z + Math.sin(t) * a[2]; b.arcs.push([wx, wz]); markNav(W.M, wx, wz, .6, 1); } if (b.spec === 'mines') initMines(b); }
  else if (slot >= 0) { pt.slots[slot].b = b; markNav(W.M, x, z, T.sz * .52, 1); }
  else if (type === 'hq') markNav(W.M, x, z, 4.4, 1);
  else markNav(W.M, x, z, 1.1, 1);
  return b;
}
function initMines(b) { const pt = W.pts[b.pt]; b.mines = []; const rad = pt.big ? 36 : pt.hq >= 0 ? 19.5 : 13.5; const n = pt.big ? 8 : pt.hq >= 0 ? 6 : 4; for (let k = 0; k < n; k++) { const a = (pt.hq >= 0 ? 0 : 0) + k * TAU / n; for (let j = -1; j <= 1; j += 2) { const aa = a + j * .12; b.mines.push({ x: pt.x + Math.cos(aa) * rad, z: pt.z + Math.sin(aa) * rad, t: 0 }); } } }

// ---------------- damage ----------------
function giveXp(u, amt) {
  if (u.dead || u.vet >= 3 || !u.T.cost) return; const p = P(u.owner); u.xp += amt * (1 + p.mod.xp);
  const th = [40, 110, 240], sc = .6 + u.T.cost / 250;
  if (u.xp >= th[u.vet] * sc) { u.vet++; const old = u.maxHp; refreshUnit(u); u.hp += u.maxHp - old; ev([8, u.id, u.vet, r1(u.x), r1(u.z), r1(u.y)]); if (u.vet === 3) p.stats.hero++; if (u.owner === ME) alertMsg(u.owner, 'vet', u.x, u.z, u.vet, u.T.n); }
}
function alertMsg(owner, code, x, z, a, name) { ev([3, owner, code, r1(x), r1(z), a || 0, name || '']); }
function hurt(tgt, dmg, wt, src, owner, opts) {
  if (tgt.dead || W.over) return;
  const cls = tgt.k === 'b' ? 4 : tgt.T.cls, m = WTM[wt][cls]; if (m <= 0) return;
  dmg *= m;
  if (tgt.k === 'u') {
    if (tgt.shield > 0) dmg *= .55; if (tgt.cov && cls < 3) dmg *= cls === 0 ? .78 : .92; if (tgt.wrT > 0) dmg *= 1 - tgt.wr; if (tgt.triT > 0) dmg *= .85;
    if (opts && opts.shock) tgt.slow = 6;
  } else { if (tgt.T.def) dmg *= [.85, .7, .55][tgt.lvl - 1]; }   // 4.1: defenses are armored
  if (W.shl && W.shl.length) for (const g of W.shl) {   // 4.3: a force field soaks up the whole hit until it breaks
    if (g.team !== tgt.team || !g.sOn || g.dead) continue; const dx = tgt.x - g.x, dz = tgt.z - g.z; if (dx * dx + dz * dz > g.sR * g.sR) continue;
    g.sp -= dmg; g.sHit = W.t; g.sFl = .18; if (g.sp <= 0) { g.sp = 0; g.sOn = false; g.sBrk = W.t; ev([1, 2, r1(g.x), r1(g.y + 4), r1(g.z), 2]); if (P(g.owner).kind !== 'ai') ev([3, g.owner, 'msg', r1(g.x), r1(g.z), 3, 'A force field broke! It recharges in ' + (g.spec === 'sregen' ? 4 : 8) + ' seconds.']); }
    return;
  }
  if (P(tgt.owner).godmode) dmg = 0;
  if (tgt.shp > 0) {   // 3.0 Legion energy shield: soaks the hit first (Tesla lightning drains it twice as fast), recharges after 3.5s out of fire
    const k = wt === 'tesla' ? 2 : 1, ab = Math.min(tgt.shp, dmg * k); tgt.shp -= ab; dmg -= ab / k; tgt.shT = 3.5; tgt.shF = .14;
    if (tgt.shp <= 0 && tgt.T.shp >= 100) ev([1, 1, r1(tgt.x), r1(tgt.y + 1.5), r1(tgt.z), 2]);   // a big shield breaking: blue burst
    if (dmg <= .001) { if (src && src.k === 'u' && !src.dead && !src.T.kami) giveXp(src, ab / k / (tgt.maxHp || 100) * tgt.T.cost * .2); return; }
  }
  if (tgt.k === 'u' && tgt.shpMax) tgt.shT = 3.5;
  tgt.hp -= dmg; tgt.flash = .1; if (tgt.k === 'b') tgt.hitT = W.t;
  if (tgt.hp > 0 && W.fx) { const key = tgt.owner; const last = W.alertT[key] || -99; if (W.t - last > 7 && P(tgt.owner).kind !== 'ai') { W.alertT[key] = W.t; alertMsg(tgt.owner, 'attack', tgt.x, tgt.z, 0, tgt.k === 'b' ? tgt.T.n : tgt.T.n); } }
  if (src && src.k === 'u' && !src.dead && !src.T.kami) giveXp(src, dmg / (tgt.maxHp || 100) * (tgt.k === 'u' ? tgt.T.cost : 150) * 0.28);
  if (tgt.hp <= 0) { if (tgt.k === 'u') killUnit(tgt, src, owner); else killBuilding(tgt, src, owner); }
}
function splashDmg(x, z, r, dmg, wt, team, owner, src, opts) {
  const out = []; hashQ(x, z, r + 3, out); const air = wt === 'bomb' || (opts && opts.air);
  for (let i = 0; i < out.length; i++) {
    const e = out[i]; if (e.dead || e.team === team) continue; if (e.T.air && !(opts && opts.hitAir)) continue; const d = Math.sqrt((e.x - x) ** 2 + (e.z - z) ** 2); const rad = r + e.T.r; if (d > rad) continue;
    hurt(e, dmg * (1 - .55 * d / rad), wt, src, owner, opts);
  }
  for (let i = W.bld.length - 1; i >= 0; i--) { const b = W.bld[i]; if (b.team === team || b.dead) continue; const d = Math.sqrt((b.x - x) ** 2 + (b.z - z) ** 2); if (b.type === 'wall') continue; if (d > r + b.sz * .6) continue; hurt(b, dmg * (1 - .5 * Math.min(1, d / (r + b.sz))), wt, src, owner, opts); }
  // walls are hit if the blast touches an arc
  for (const pt of W.pts) { const wb = pt.wall; if (!wb || wb.dead || wb.team === team) continue; for (const a of wb.arcs) { const d = Math.sqrt((a[0] - x) ** 2 + (a[1] - z) ** 2); if (d < r) { hurt(wb, dmg * .7, wt, src, owner, opts); break; } } }
}
function ticketCost(T) { return Math.max(1, Math.round(T.pop / 2)); }
function killUnit(u, src, owner) {
  if (u.dead) return; u.dead = true;
  if (u.cargo && u.cargo.length) { const cg = u.cargo.splice(0); for (const c of cg) { c.dead = false; c.inCraft = 0; c.x = u.x; c.z = u.z; c.y = u.y; killUnit(c, src, owner); } }   // 3.0: a sunk Landing Craft takes everyone aboard with it
  const p = P(u.owner); p.pop -= u.T.pop; p.stats.lost++;
  if (u.boss && W.war) { const me = W.players[0], b = 600 + W.war.wave * 80; me.sup += b; ev([3, 0, 'msg', r1(u.x), r1(u.z), 3, (u.nick || 'The Warlord') + ' is down! Bounty: +' + b + ' money.']); }
  const i = W.units.indexOf(u); if (i >= 0) { W.units[i] = W.units[W.units.length - 1]; W.units.pop(); } W.byId.delete(u.id);
  const sz = u.T.cls >= 2 ? 3 : u.T.cls === 1 || u.T.cls === 3 ? 2 : 1;
  ev([2, UTK.indexOf(u.type), r1(u.x), r1(u.y), r1(u.z), r1(u.rot), u.owner]);
  if (sz >= 2) ev([1, sz, r1(u.x), r1(u.y + .5), r1(u.z), 0]);
  if (!W.o.sandbox) { const tm = W.teams[u.team]; if (tm) tm.tickets -= ticketCost(u.T); }
  if (u.T.naval) { const ko0 = src && src.k === 'u' ? src.owner : owner; if (ko0 !== undefined && ko0 >= 0 && W.players[ko0]) W.players[ko0].stats.ships = (W.players[ko0].stats.ships || 0) + 1; }   // 3.0 Admiral
  if (src && src.k === 'u') { const sp = P(src.owner); sp.stats.kills++; if (u.T.air) sp.stats.air++; if (!src.dead) giveXp(src, u.T.cost * .22); }
  else if (owner !== undefined && owner >= 0) { P(owner).stats.kills++; if (u.T.air) P(owner).stats.air++; }
  const ko = src && src.k === 'u' ? src.owner : owner; if (ko !== undefined && ko >= 0 && W.players[ko] && W.players[ko].team !== u.team) { const kp = W.players[ko]; if (kp.bounty) kp.sup += u.T.cost * kp.bounty; if (u.ace) aceKilled(u, ko); }
}
function killBuilding(b, src, owner) {
  if (b.dead) return; b.dead = true; const p = P(b.owner); const pt = b.pt >= 0 ? W.pts[b.pt] : null; refundTraining(b);
  const i = W.bld.indexOf(b); if (i >= 0) { W.bld[i] = W.bld[W.bld.length - 1]; W.bld.pop(); } W.byId.delete(b.id);
  if (b.type === 'wall') { if (pt) pt.wall = null; for (const a of b.arcs) markNav(W.M, a[0], a[1], .6, -1); }
  else if (b.slot >= 0 && pt) { pt.slots[b.slot].b = null; markNav(W.M, b.x, b.z, b.T.sz * .52, -1); }
  else if (b.type === 'hq') markNav(W.M, b.x, b.z, 4.4, -1); else markNav(W.M, b.x, b.z, 1.1, -1);
  ev([1, b.type === 'hq' ? 4 : 3, r1(b.x), r1(b.y + 2), r1(b.z), 0]); if (b.type === 'hq') for (let k = 0; k < 5; k++) ev([1, 3, r1(b.x + rr(-6, 6)), r1(b.y + rr(1, 5)), r1(b.z + rr(-6, 6)), 0]);
  alertMsg(b.owner, 'bldlost', b.x, b.z, 0, b.T.n);
  if (owner !== undefined && owner >= 0) P(owner).stats.kills++;
  if (b.type === 'hq') { if (W.o.war) { warHqDown(b); return; } b.owner === ME && alertMsg(b.owner, 'hqlost', b.x, b.z, 0, ''); eliminate(p, 'HQ destroyed', owner); }
}
function eliminate(p, why, killerOwner) {
  if (!p.alive) return; p.alive = false; p.out = why;
  for (const pt of W.pts) { if (pt.owner === p.id) { pt.owner = -1; pt.ctrl = 0; pt.capP = -1; if (pt.hq >= 0) pt.hq = -1; } }
  for (const u of W.units.slice()) if (u.owner === p.id) { u.dead = true; p.pop -= u.T.pop; const i = W.units.indexOf(u); if (i >= 0) { W.units[i] = W.units[W.units.length - 1]; W.units.pop(); } W.byId.delete(u.id); ev([1, 2, r1(u.x), r1(u.y), r1(u.z), 0]); }
  for (const b of W.bld.slice()) if (b.owner === p.id) { b.dead = true; const pt = b.pt >= 0 ? W.pts[b.pt] : null; if (b.type === 'wall') { if (pt) pt.wall = null; for (const a of b.arcs) markNav(W.M, a[0], a[1], .6, -1); } else if (b.slot >= 0 && pt) { pt.slots[b.slot].b = null; markNav(W.M, b.x, b.z, b.T.sz * .52, -1); } const i = W.bld.indexOf(b); if (i >= 0) { W.bld[i] = W.bld[W.bld.length - 1]; W.bld.pop(); } W.byId.delete(b.id); ev([1, 3, r1(b.x), r1(b.y + 1), r1(b.z), 0]); }
  ev([3, -1, 'elim', 0, 0, 0, p.name]);
  checkWin(killerOwner);
}
function checkWin(killer) {
  if (W.over || W.o.sandbox || W.o.war || W.inCheck) return; W.inCheck = true;
  try {
    for (const t of W.teamList) {
      if (!t.alive) continue;
      if (t.tickets <= 0) for (const i of t.players) if (W.players[i].alive) eliminate(W.players[i], 'Out of tickets');
      if (!t.players.some(i => W.players[i].alive)) t.alive = false;
    }
    const left = W.teamList.filter(t => t.alive);
    if (left.length <= 1) {
      W.over = true; W.winner = left.length ? left[0].id : -1; const lost = W.teamList.filter(t => !t.alive);
      const lp = []; for (const t of lost) for (const i of t.players) lp.push(W.players[i]);
      W.reason = lp.some(q => q.out === 'Disconnected') ? 'Opponent disconnected' : lp.some(q => q.out === 'Surrendered') ? 'Opponent surrendered' : lp.some(q => q.out === 'Out of tickets') ? 'Enemy score ran out' : 'Enemy HQ destroyed';
      ev([12, W.winner, W.reason]);
    }
  } finally { W.inCheck = false; }
}

// ---------------- targeting & combat ----------------
function effMult(w, tgt) {
  const air = tgt.k === 'u' && tgt.T.air; if (air) { if (w.g === 'g') return 0; } else if (w.g === 'a') return 0;
  return WTM[w.wt][tgt.k === 'b' ? 4 : tgt.T.cls];
}
function uRange(u, w) { const p = P(u.owner); return w.rng * (1 + p.mod.rng) * (u.fromArtPark && (u.T.eq || u.T.id) === 'artillery' ? 1.2 : 1) * (u.rngB || 1); }
function weaponsOf(e) { return e.k === 'u' ? e.T : null; }
// 4.1 target types: 0 any, 1 soldiers, 2 vehicles and tanks, 3 aircraft, 4 buildings
const TPN = ['Any', 'Soldiers', 'Vehicles', 'Aircraft', 'Buildings'];
function tpMatch(tp, e) { return tp === 4 ? e.k === 'b' : e.k === 'u' && (tp === 1 ? e.T.cls === 0 : tp === 2 ? (e.T.cls === 1 || e.T.cls === 2) : e.T.air); }
function scoreTarget(u, w, e, d) {
  let s = -d; const m = effMult(w, e); if (u.tp) s += tpMatch(u.tp, e) ? 45 : -12;
  if (e.k === 'u') {
    const et = e.T; s += m * 9; if (et.w && effMult(et.w, u) > 0) s += 7; if (et.heal) s += 3; if (et.eng) s += 2;
    const uid = u.T.eq || u.T.id; if (uid === 'sniper' && et.cls === 0) s += 10; if (uid === 'aa' && et.air) s += 24; if (w.wt === 'aam' && et.air) s += 12;
    if ((w.wt === 'rocket' || w.wt === 'cannon' || w.wt === 'plasma') && et.cls >= 1) s += 9; if (w.wt === 'tesla' && e.shp > 0) s += 6;
    if (et.air && w.g !== 'g' && w.wt !== 'aam' && w.wt !== 'flak') s -= 6;
  } else { s += m * 4 - 10; if (e.w) s += 14; if (e.type === 'wall') s -= 30; if (w.wt === 'shell' && w.rng > 50) s += 10; if (e.prog < 1) s += 3; }
  return s;
}
function acquire(u, wa, range) {
  let best = null, bs = -1e9; const team = u.team, out = tmpA;
  hashQ(u.x, u.z, range, out);
  for (let i = 0; i < out.length; i++) {
    const e = out[i]; if (e.team === team || e.dead) continue; if (!seen(team, e.x, e.z)) continue;
    let ok = false, w = null; for (let j = 0; j < wa.length; j++) { const mm = effMult(wa[j], e); if (mm >= .18) { ok = true; w = wa[j]; break; } } if (!ok) continue;
    const d = Math.sqrt((e.x - u.x) ** 2 + (e.z - u.z) ** 2); if (w.minr && d < w.minr) continue;
    const sc = scoreTarget(u, w, e, d); if (sc > bs) { bs = sc; best = e; }
  }
  for (let i = 0; i < W.bld.length; i++) {
    const b = W.bld[i]; if (b.team === team || b.dead) continue; const d = Math.sqrt((b.x - u.x) ** 2 + (b.z - u.z) ** 2) - b.sz * .5; if (d > range) continue;
    if (!seen(team, b.x, b.z)) continue;
    let ok = null; for (let j = 0; j < wa.length; j++) if (effMult(wa[j], b) >= .18 && !(wa[j].g === 'a')) { ok = wa[j]; break; } if (!ok) continue; if (ok.minr && d < ok.minr) continue;
    const sc = scoreTarget(u, ok, b, d); if (sc > bs) { bs = sc; best = b; }
  }
  // walls as targets only if nothing else (units blocked)
  return best;
}
function dmgOf(u, w) {
  const p = P(u.owner), m = p.mod; let d = w.dmg * VETDMG[u.vet] * u.dmB;
  switch (w.wt) { case 'bullet': case 'snipe': case 'comm': case 'pulse': case 'rail': d *= 1 + m.dmgBul; break; case 'rocket': case 'cannon': case 'aam': case 'plasma': d *= 1 + m.dmgAT; break; case 'shell': case 'bomb': d *= 1 + m.dmgShell; break; }
  if (u.armT > 0) d *= 1.12; if (u.jamT > 0) d *= .8;
  if (u.T.air && p.hqB) { for (const b of W.bld) { if (b.owner === u.owner && b.type === 'airfield' && b.spec === 'gunship' && b.prog >= 1) { d *= 1.15; break; } } }
  return d;
}
function fire(u, w, tg, idx) {
  const T = u.T; const dx = tg.x - u.x, dz = tg.z - u.z; let d = Math.sqrt(dx * dx + dz * dz);
  const rate = u.stimT > 0 ? .8 : 1; if (idx === 1) u.cd1 = w.cd * rate * (.92 + Math.random() * .16); else u.cd2 = w.cd * rate * (.92 + Math.random() * .16);
  u.firing = .25; u.nShot = (u.nShot | 0) + 1;
  const sy = u.y + (T.air ? 0 : T.cls >= 1 ? 2.2 : 1.3); let ty = tg.k === 'b' ? tg.y + tg.T.sz * .35 : tg.y + (tg.T.air ? 0 : tg.T.cls >= 1 ? 1.6 : .9);
  let tx = tg.x, tz = tg.z;
  const p = P(u.owner);
  const dmg0 = dmgOf(u, w) * (tg.k === 'b' ? 1 + p.mod.bldDmg : 1) * (1 + clamp((u.y - tg.y) * .025, -.1, .15));
  if (w.kami) { }
  if (w.ps > 0) {
    const dur = Math.max(.12, d / w.ps + (w.arc ? .5 : 0));
    if (tg.k === 'u' && (tg.vx || tg.vz)) { tx += tg.vx * dur * .85; tz += tg.vz * dur * .85; }
    const n = w.shots;
    for (let s = 0; s < n; s++) {
      let ex = tx, ez = tz; if (w.scat) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * w.scat; ex += Math.cos(a) * r; ez += Math.sin(a) * r; } else if (w.arc) { const a = Math.random() * TAU, r = d * .012 * Math.random(); ex += Math.cos(a) * r; ez += Math.sin(a) * r; }
      const dd = dur + s * .06;
      const pr = { sx: u.x, sy, sz: u.z, tx: ex, ty: w.arc ? W.M.H(ex, ez) : ty, tz: ez, t0: W.t, dur: dd, src: u, owner: u.owner, team: u.team, dmg: dmg0, wt: w.wt, spl: w.spl * (1 + p.mod.spl), tid: tg.id, arc: w.arc, k: w.k, shock: w.shock };
      W.proj.push(pr); ev([0, w.k, r1(u.x), r1(sy), r1(u.z), r1(ex), r1(pr.ty), r1(ez), r1(dd), u.id, w.arc ? 1 : 0]);
    }
  } else if (w.chain) {   // 3.0 Arc Trooper: the bolt jumps from the target to the enemies around it
    const out = hashQ(tg.x, tg.z, 8, _chainA), hits = _chainH; hits.length = 0; hits.push(tg);
    for (let i = 0; i < out.length && hits.length < w.chain; i++) { const e = out[i]; if (e === tg || e.dead || e.team === u.team || !seen(u.team, e.x, e.z)) continue; hits.push(e); }
    let px = u.x, py = sy, pz = u.z;
    for (let i = 0; i < hits.length; i++) { const e = hits[i], ey = e.y + (e.T.air ? 0 : 1); ev([0, 5, r1(px), r1(py), r1(pz), r1(e.x), r1(ey), r1(e.z), 0, u.id, 0]); hurt(e, dmg0, w.wt, u, u.owner, { shock: w.shock }); px = e.x; py = ey; pz = e.z; }
    hits.length = 0;
  } else {
    // hitscan
    const rng = uRange(u, w); let acc = w.wt === 'snipe' || w.wt === 'rail' ? .93 : clamp(1.02 - d / rng * .45, .5, 1); acc = Math.min(1, acc * (1 + p.mod.acc)) * W.wx.acc; if (tg.k === 'u' && tg.cov) acc *= .85;
    const hit = Math.random() < acc;
    let ex = tx, ez = tz, ey = ty; if (!hit) { ex += rr(-2.5, 2.5); ez += rr(-2.5, 2.5); }
    if (w.wt === 'flak') { splashDmg(tg.x, tg.z, Math.max(w.spl, 1.5), dmg0, w.wt, u.team, u.owner, u, { hitAir: 1 }); } else if (hit) hurt(tg, dmg0, w.wt, u, u.owner);
    ev([0, w.k, r1(u.x), r1(sy), r1(u.z), r1(ex), r1(ey), r1(ez), 0, u.id, 0]);
  }
}
function impact(pr) {
  const tgt = W.byId.get(pr.tid); const src = pr.src && !pr.src.dead ? pr.src : null;
  if (pr.spl > 0) {
    splashDmg(pr.tx, pr.tz, pr.spl, pr.dmg, pr.wt, pr.team, pr.owner, src, { shock: pr.shock });
    ev([1, pr.spl > 7 ? 3 : 2, r1(pr.tx), r1(pr.ty), r1(pr.tz), pr.shock || pr.k === 12 ? 2 : 0]);   // plasma: blue blast
  } else {
    if (tgt && !tgt.dead && tgt.team !== pr.team && Math.abs(tgt.x - pr.tx) < 7 && Math.abs(tgt.z - pr.tz) < 7) hurt(tgt, pr.dmg, pr.wt, src, pr.owner);
    else { // stray: damage anything very close
      const out = []; hashQ(pr.tx, pr.tz, 2.6, out); for (const e of out) if (e.team !== pr.team && !e.dead && (!e.T.air || pr.wt === 'aam' || pr.wt === 'flak')) { hurt(e, pr.dmg * .8, pr.wt, src, pr.owner); break; }
    }
    ev([1, 1, r1(pr.tx), r1(pr.ty), r1(pr.tz), pr.k === 12 ? 2 : 0]);
  }
}
function turnTo(cur, want, rate, dt) { const d = angDiff(cur, want); const s = rate * dt; return Math.abs(d) <= s ? want : cur + Math.sign(d) * s; }
const _chainA = [], _chainH = [];

// ---------------- unit logic ----------------
function unitSpeed(u) {
  const T = u.T, m = P(u.owner).mod; let s = T.spd * u.spB; s *= 1 + (T.cls === 0 ? m.spdInf : T.air ? m.spdAir : m.spdVeh);
  if (u.slow > 0) s *= .55; if (u.stimT > 0) s *= 1.1; if (!T.air && !T.naval && !T.hover) s *= T.cls === 0 ? W.wx.spdI : W.wx.spdV;   // 3.0 weather: mud and snow
  if (u.spdCap && u.spdCap < s) s = u.spdCap;
  if (T.air) { const pb = P(u.owner); for (const b of W.bld) if (b.owner === u.owner && b.type === 'airfield' && b.spec === 'superiority' && b.prog >= 1) { s *= 1.15; break; } }
  return s;
}
function moveTo(u, tx, tz, dt, arrive) {
  const M = W.M, T = u.T; const dx = tx - u.x, dz = tz - u.z, d = Math.sqrt(dx * dx + dz * dz);
  if (d <= arrive) { u.vx *= .5; u.vz *= .5; return true; }
  let mx = dx / d, mz = dz / d;
  if (!T.air && d > 3) {
    const nv = T.naval ? M.navW : M.nav;
    if ((u.losT -= dt) <= 0) { u.los = d < 70 && (T.naval ? losN(nv, u.x, u.z, tx, tz) : losClear(M, u.x, u.z, tx, tz, T.jump)); u.losT = .25 + Math.random() * .15; }
    if (u.wpT > 0) { u.wpT -= dt; const wx = u.wpx - u.x, wz = u.wpz - u.z, wl = Math.sqrt(wx * wx + wz * wz); if (wl > .7) { mx = wx / wl; mz = wz / wl; } else u.wpT = 0; }   // 3.1: short escape waypoint
    else if (!u.los) {
      const far = d > 20; let f = getField(M, tx, tz, far, nv); if (!f && !far) f = getField(M, tx, tz, true, nv);
      const n = nv, i = n.idx(u.x, u.z), k = f ? f.dir[i] : -2;
      if (!f) { }
      else if (T.naval && f.dist[i] >= 1e9 && !n.blk[i]) { u.vx *= .5; u.vz *= .5; return true; }   // 3.0: no way there by sea (inland, or another sea): stop instead of pushing at the shore
      else if (k < 0 && f.dist[i] > 0) { const e = escapeCell(M, f, u.x, u.z, nv); if (e) { u.wpx = e[0]; u.wpz = e[1]; u.wpT = 1.5; const wx = e[0] - u.x, wz = e[1] - u.z, wl = Math.sqrt(wx * wx + wz * wz) || 1; mx = wx / wl; mz = wz / wl; } }
      else if (k >= 0) {
        let cx = i % n.nx, cz = (i / n.nx) | 0; cx += NB[k][0]; cz += NB[k][1];
        let j = cz * n.nx + cx, k2 = f.dir[j]; if (k2 >= 0) { cx += NB[k2][0]; cz += NB[k2][1]; j = cz * n.nx + cx; const k3 = f.dir[j]; if (k3 >= 0 && ((k3 + 8 - k2) & 7) < 2) { cx += NB[k3][0]; cz += NB[k3][1]; } }
        const wx = -M.hw + (cx + .5) * n.cs - u.x, wz = -M.hd + (cz + .5) * n.cs - u.z, wl = Math.sqrt(wx * wx + wz * wz) || 1; mx = wx / wl; mz = wz / wl;
      }
    }
  }
  let spd = unitSpeed(u);
  const want = Math.atan2(mx, mz), ad = Math.abs(angDiff(u.rot, want));
  if (T.cls >= 1 && !T.air) { if (ad > 1.1) spd *= .35; else if (ad > .5) spd *= .7; }
  const slow = d < 4 ? clamp(d / 4, .4, 1) : 1;
  const f = Math.min(1, dt * 7); u.vx += (mx * spd * slow - u.vx) * f; u.vz += (mz * spd * slow - u.vz) * f;
  return false;
}
function applyVel(u, dt) {
  const M = W.M, T = u.T; const sp = Math.sqrt(u.vx * u.vx + u.vz * u.vz);
  if (sp < .05) { u.moving = false; return; }
  let nx = u.x + u.vx * dt, nz = u.z + u.vz * dt;
  if (!T.air && !blockedFor(u, M, u.x, u.z)) {      // (a unit standing inside a blocked cell may always move, so it can walk out)
    if (blockedFor(u, M, nx, nz)) {
      if (!blockedFor(u, M, nx, u.z)) { nz = u.z; u.vz = 0; } else if (!blockedFor(u, M, u.x, nz)) { nx = u.x; u.vx = 0; }
      else { // 3.1: wedged in a corner: try sliding 45 degrees either way before giving up
        const c = .7071, a = [[(u.vx - u.vz) * c, (u.vx + u.vz) * c], [(u.vx + u.vz) * c, (u.vz - u.vx) * c]]; let ok = false;
        for (const v of a) { const px = u.x + v[0] * dt, pz = u.z + v[1] * dt; if (!blockedFor(u, M, px, pz)) { nx = px; nz = pz; ok = true; break; } }
        if (!ok) { nx = u.x; nz = u.z; u.vx = u.vz = 0; }
      }
    }
  }
  if (nx < -M.hw + 2) nx = -M.hw + 2; if (nx > M.hw - 2) nx = M.hw - 2; if (nz < -M.hd + 2) nz = -M.hd + 2; if (nz > M.hd - 2) nz = M.hd - 2;
  u.x = nx; u.z = nz; u.moving = true;
  if (sp > .6) { const want = Math.atan2(u.vx, u.vz); u.rot = turnTo(u.rot, want, T.cls === 0 ? 10 : T.air ? 4 : T.cls === 2 ? 2.4 : 3.6, dt); }
}
// 3.1 pathfinding helpers: the nearest cell (around a blocked or cut-off one) that has a route to the target
function escapeCell(M, f, x, z, nv) {
  const n = nv || M.nav, nx = n.nx, nz = n.nz, i0 = n.idx(x, z), cx = i0 % nx, cz = (i0 / nx) | 0; let best = -1, bs = 1e18;
  for (let r = 1; r <= 12; r++) {
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const px = cx + a, pz = cz + b; if (px < 1 || pz < 1 || px >= nx - 1 || pz >= nz - 1) continue; const j = pz * nx + px; if (n.blk[j] | n.dyn[j] || f.dist[j] >= 1e9) continue; const sc = f.dist[j] + Math.sqrt(a * a + b * b) * 3; if (sc < bs) { bs = sc; best = j; } }
    if (best >= 0 && r >= 2) break;
  }
  if (best < 0) return null; return [-M.hw + (best % nx + .5) * n.cs, -M.hd + (((best / nx) | 0) + .5) * n.cs];
}
// a unit that has stopped making progress picks a nearby free spot that is closer to its goal (by the route, not the straight line)
function unstick(u) {
  const M = W.M, n = navOf(u), f = getField(M, u.tx, u.tz, Math.hypot(u.tx - u.x, u.tz - u.z) > 20, n); if (!f) return false; const cur = f.dist[n.idx(u.x, u.z)]; let best = null, bs = cur >= 1e9 ? 1e18 : cur - .5;
  for (const r of [2.5, 4.5, 7]) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + r, px = u.x + Math.cos(a) * r, pz = u.z + Math.sin(a) * r; if (!M.inb(px, pz) || (u.T.naval ? n.blk[n.idx(px, pz)] : navBlockedAt(M, px, pz)) || !(u.T.naval ? losN(n, u.x, u.z, px, pz) : losClear(M, u.x, u.z, px, pz))) continue; const dv = f.dist[n.idx(px, pz)]; if (dv >= 1e9) continue; const sc = dv + r * .3; if (sc < bs) { bs = sc; best = [px, pz]; } }
  if (!best) return false; u.wpx = best[0]; u.wpz = best[1]; u.wpT = 1.4; u.los = false; u.losT = 1.4; return true;
}
// 4.3: separation uses its own fine grid (4 m cells, rebuilt each tick): in a packed army each unit now checks its
// close neighbours instead of every unit in a 12 m cell (hundreds), the main cost of big armies on slow computers
let SEP = null;
function sepBuild() {
  const M = W.M, us = W.units, n = us.length, CS = 4, nx = Math.ceil(M.w / CS) + 1, nz = Math.ceil(M.d / CS) + 1, NC = nx * nz;
  if (!SEP || SEP.NC !== NC) SEP = { nx, nz, NC, start: new Int32Array(NC + 1), cur: new Int32Array(NC), cell: new Int32Array(0), list: [] };
  const S = SEP; if (S.cell.length < n) S.cell = new Int32Array(n * 2 + 64); const cnt = S.cur; cnt.fill(0);
  for (let i = 0; i < n; i++) { const u = us[i]; const c = clamp(((u.z + M.hd) / CS) | 0, 0, nz - 1) * nx + clamp(((u.x + M.hw) / CS) | 0, 0, nx - 1); S.cell[i] = c; cnt[c]++; }
  let acc = 0; for (let c = 0; c < NC; c++) { S.start[c] = acc; acc += cnt[c]; cnt[c] = S.start[c]; } S.start[NC] = acc;
  S.list.length = n; for (let i = 0; i < n; i++) S.list[cnt[S.cell[i]]++] = us[i];
}
function separate(u, dt) {
  const T = u.T; if (T.air && !T.rotor) return; const R = T.r + 3, S = SEP, Mm = W.M; let px = 0, pz = 0;
  const c0 = clamp(((u.x - R + Mm.hw) / 4) | 0, 0, S.nx - 1), c1 = clamp(((u.x + R + Mm.hw) / 4) | 0, 0, S.nx - 1), r0 = clamp(((u.z - R + Mm.hd) / 4) | 0, 0, S.nz - 1), r1 = clamp(((u.z + R + Mm.hd) / 4) | 0, 0, S.nz - 1);
  for (let ra = r0; ra <= r1; ra++) for (let cb = c0; cb <= c1; cb++) { const c = ra * S.nx + cb, k1 = S.start[c + 1]; for (let k = S.start[c]; k < k1; k++) {
    const e = S.list[k]; if (e === u || e.T.air !== T.air || !e.T.naval !== !T.naval) continue; const dx = u.x - e.x, dz = u.z - e.z, dd = dx * dx + dz * dz, min = (T.r + e.T.r) * (T.air ? 1.2 : 1); if (dd >= min * min) continue;
    const d = Math.sqrt(dd) || .01; let w = (min - d) / min; const em = e.moving || e.o !== 0, um = u.moving || u.o !== 0; w *= em && !um ? 1.4 : um && !em ? .35 : 1;
    px += dx / d * w; pz += dz / d * w;
  } }
  if (px || pz) { const M = W.M; const nx = clamp(u.x + px * 9 * dt, -M.hw + 2, M.hw - 2), nz = clamp(u.z + pz * 9 * dt, -M.hd + 2, M.hd - 2); if (T.air || !blockedFor(u, M, nx, nz)) { u.x = nx; u.z = nz; } }
}
function groundY(u) { return W.M.H(u.x, u.z) + (u.T.air ? u.T.alt : 0); }

function updUnit(u, dt) {
  const T = u.T, M = W.M;
  if (u.ghost > 0) u.ghost -= dt;
  u.px = u.x; u.pz = u.z; u.prot = u.rot; u.paim = u.aim;
  if (u.flash > 0) u.flash -= dt; if (u.slow > 0) u.slow -= dt; if (u.shield > 0) u.shield -= dt; if (u.firing > 0) u.firing -= dt;
  if (u.cd1 > 0) u.cd1 -= dt; if (u.cd2 > 0) u.cd2 -= dt;
  if (u.stimT > 0) u.stimT -= dt; if (u.triT > 0) u.triT -= dt; if (u.armT > 0) u.armT -= dt; if (u.jamT > 0) u.jamT -= dt; if (u.wrT > 0) u.wrT -= dt;
  if (u.life > 0) { u.life -= dt; if (u.life <= 0) { ev([1, 1, r1(u.x), r1(u.y), r1(u.z), 1]); alertMsg(u.owner, 'expire', u.x, u.z, 0, T.n); u.dead = true; const p = P(u.owner); p.pop -= T.pop; const i = W.units.indexOf(u); if (i >= 0) { W.units[i] = W.units[W.units.length - 1]; W.units.pop(); } W.byId.delete(u.id); return; } }
  if (u.vet >= 3 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .008 * dt);
  if (u.shpMax) { if (u.shF > 0) u.shF -= dt; if (u.shT > 0) u.shT -= dt; else if (u.shp < u.shpMax) u.shp = Math.min(u.shpMax, u.shp + u.shpMax * .25 * (1 + P(u.owner).mod.shRegen) * dt); }   // 3.0 shields recharge out of fire
  const w1 = T.w, w2 = T.w2; const weapons = w1 ? (w2 ? [w1, w2] : [w1]) : null;
  // ---- support abilities ----
  if (T.heal) healTick(u, dt); if (T.eng || T.mech) engTick(u, dt);
  // ---- target maintenance ----
  let tg = null;
  if (u.o === 3) { tg = W.byId.get(u.tid); if (!tg || tg.dead || (tg.k === 'u' && !teamVisible(u.team, tg) && Math.random() < .02)) { tg = null; u.o = u.am ? 2 : 0; } }
  else if (weapons && u.o !== 5 && u.o !== 7) {
    if (u.tgt && (u.tgt.dead || !seen(u.team, u.tgt.x, u.tgt.z))) u.tgt = null;
    if ((u.scan -= dt) <= 0) {
      u.scan = .32 + Math.random() * .14;
      const rg = Math.max(uRange(u, w1), w2 ? uRange(u, w2) : 0);
      const acqR = u.o === 4 ? rg : (u.o === 1 ? rg : rg + (u.o === 2 ? 6 : 4));
      if (u.o !== 1 || !T.sf) { const nt = acquire(u, weapons, Math.min(acqR, 95)); if (nt) u.tgt = nt; else if (u.tgt && Math.random() < .5) { /* keep */ } }
    }
    tg = u.tgt;
  }
  // ---- kamikaze ----
  if (T.kami) { if (tg && !tg.dead) { const d = Math.hypot(tg.x - u.x, tg.z - u.z); if (d < 2.6) { splashDmg(u.x, u.z, w1.spl, dmgOf(u, w1), 'bomb', u.team, u.owner, u, {}); ev([1, 2, r1(u.x), r1(u.y), r1(u.z), 0]); killUnit(u, null, -1); P(u.owner).stats.lost--; return; } } }
  // ---- 4.2 guards: their post is the anchor; with nobody to fight they walk back to it ----
  if (u.guard) {
    const gx = u.guard[2], gz = u.guard[3];
    if (u.o === 3 && Math.hypot(u.x - gx, u.z - gz) > 36) { u.tgt = null; tg = null; u.o = 6; u.tx = u.guard[0]; u.tz = u.guard[1]; u.arr = 1.5; u.stuck = 0; }   // do not get lured away
    else if (u.o === 0) {
      u.anchorX = u.guard[0]; u.anchorZ = u.guard[1];
      if (!tg && weapons && (u.gT = (u.gT || 0) - dt) <= 0) {   // anyone inside the guarded area gets chased off
        u.gT = .5; const out = tmpA; hashQ(gx, gz, 28, out); let best = null, bd = 1e9;
        for (const e of out) { if (e.team === u.team || e.dead || !seen(u.team, e.x, e.z) || !weapons.some(w => effMult(w, e) >= .18)) continue; const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < bd) { bd = d; best = e; } }
        if (best) { u.o = 3; u.tid = best.id; u.tgt = best; u.am = true; tg = best; }
      }
      if (!tg && u.o === 0 && Math.hypot(u.x - u.guard[0], u.z - u.guard[1]) > 4) { u.o = 6; u.tx = u.guard[0]; u.tz = u.guard[1]; u.arr = 1.5; u.stuck = 0; }
    }
  }
  // ---- movement / engagement ----
  let engaged = false;
  if (tg) {
    const dx = tg.x - u.x, dz = tg.z - u.z; const d = Math.sqrt(dx * dx + dz * dz) - (tg.k === 'b' ? tg.sz * .45 : 0);
    let wuse = null; for (const w of weapons) if (effMult(w, tg) > 0) { wuse = w; break; }
    if (!wuse) { u.tgt = null; tg = null; }
    else {
      const rg = uRange(u, wuse) * (u.o === 3 || u.o === 2 || u.o === 0 ? .94 : 1);
      const inR = d <= rg && !(wuse.minr && d < wuse.minr);
      if (inR) {
        engaged = true; u.aim = turnTo(u.aim, Math.atan2(dx, dz), T.tur ? 5 : 11, dt);
        const aligned = Math.abs(angDiff(u.aim, Math.atan2(dx, dz))) < .3;
        if (!(T.sf && u.moving && u.o === 1)) {
          // stop to fire for stationary-fire units and when engaging
          for (let wi = 0; wi < weapons.length; wi++) {
            const w = weapons[wi]; const cdv = wi === 0 ? u.cd1 : u.cd2; if (cdv > 0 || !aligned) continue; if (effMult(w, tg) <= 0) continue; const dd = Math.sqrt((tg.x - u.x) ** 2 + (tg.z - u.z) ** 2); if (dd > uRange(u, w) || (w.minr && dd < w.minr)) continue;
            if (T.sf && u.moving) continue; fire(u, w, tg, wi === 0 ? 1 : 2);
          }
        }
        if (u.o === 3 || u.o === 2 || u.o === 0) { if (T.sf || u.o !== 1) { u.vx *= .6; u.vz *= .6; } }
      } else if (u.o === 3 || (u.o === 2) || (u.o === 0 && Math.hypot(u.x - u.anchorX, u.z - u.anchorZ) < 30)) {
        if (!(u.o === 0 && !T.w)) { // chase
          if (T.air || !wuse.minr || true) { moveTo(u, tg.x, tg.z, dt, rg * .8); engaged = true; }
          if (u.o === 0 && u.moving && Math.hypot(u.x - u.anchorX, u.z - u.anchorZ) > 30) u.tgt = null;
          const ang = Math.atan2(dx, dz); u.aim = turnTo(u.aim, u.moving ? u.rot : ang, T.tur ? 4 : 8, dt);
        }
      } else if (u.o === 1 || u.o === 4) {
        // opportunity fire while moving (non-stationary-fire units)
        if (u.o === 1 && d <= rg && !T.sf) { }
      }
    }
  }
  if (!engaged || u.o === 1) {
    if (u.o === 1 || (u.o === 2 && !engaged) || u.o === 6) {
      const arrived = moveTo(u, u.tx, u.tz, dt, u.arr);
      // opportunity fire
      if (u.o === 1 && tg && weapons && !T.sf) { const dx = tg.x - u.x, dz = tg.z - u.z; u.aim = turnTo(u.aim, Math.atan2(dx, dz), T.tur ? 5 : 11, dt); for (let wi = 0; wi < weapons.length; wi++) { const w = weapons[wi]; const cdv = wi === 0 ? u.cd1 : u.cd2; if (cdv > 0 || effMult(w, tg) <= 0) continue; const dd = Math.hypot(dx, dz); if (dd <= uRange(u, w) && !(w.minr && dd < w.minr) && Math.abs(angDiff(u.aim, Math.atan2(dx, dz))) < .35) fire(u, w, tg, wi === 0 ? 1 : 2); } }
      else if (!engaged && T.tur) u.aim = turnTo(u.aim, u.rot, 3, dt); else if (!engaged && !tg) u.aim = turnTo(u.aim, u.rot, 9, dt);
      // stuck detection
      if (!arrived) { const mv = u.dmv || 0; if (mv < unitSpeed(u) * dt * .25) { u.stuck += dt; } else u.stuck = Math.max(0, u.stuck - dt); if (u.stuck > 1.6 && Math.hypot(u.tx - u.x, u.tz - u.z) < 12 + u.arr * 2) arrived_(u); else if (u.stuck > 1.2 && !T.air && (u.unst | 0) < 6 && unstick(u)) { u.stuck = 0; u.unst = (u.unst | 0) + 1; if (u.unst >= 2) u.ghost = 3; } else if (u.stuck > 2.5 && !T.air && !(u.ghost > 0)) { u.ghost = 3.5; u.stuck = 1.2; } else if (u.stuck > 9) arrived_(u); }
      else arrived_(u);
    } else if (u.o === 7) { boardTick(u, dt); if (u.dead) return; }   // 3.0 walking to a Landing Craft
    else if (u.o === 5) { // build nest
      const arrived = moveTo(u, u.tx, u.tz, dt, 4);
      if (arrived) { nestBuild(u); u.o = 0; }
    } else { u.vx *= Math.max(0, 1 - dt * 8); u.vz *= Math.max(0, 1 - dt * 8); if (!engaged) u.aim = turnTo(u.aim, u.rot, 6, dt); }
  }
  if (u.o === 0 && !engaged && u.moving === false && !u.guard) { u.anchorX = u.x; u.anchorZ = u.z; }
  if (u.unl && (u.unlT = (u.unlT || 0) - dt) <= 0) { u.unlT = .3; if (!u.cargo || !u.cargo.length) u.unl = null; else if (u.o === 0 || Math.hypot(u.tx - u.x, u.tz - u.z) < 6) { if (!unloadCraft(u, u.unl.x, u.unl.z) && u.o === 0) { u.unl = null; if (u.owner === ME) alertMsg(u.owner, 'msg', u.x, u.z, 3, 'No beach here to land on. Pick a spot closer to the shore.'); } } }   // 3.0 Landing Craft
  applyVel(u, dt); u.dmv = Math.hypot(u.x - u.px, u.z - u.pz);
  if (u.vx * u.vx + u.vz * u.vz < .01) u.moving = false;
  if (T.air) u.y = lerp(u.y, M.H(u.x, u.z) + T.alt, Math.min(1, dt * 3)); else u.y = T.naval ? M.wl : M.H(u.x, u.z);
}
function arrived_(u) {
  u.unst = 0; u.wpT = 0;
  if (u.o === 1 || u.o === 6) { u.o = 0; u.spdCap = 0; u.anchorX = u.x; u.anchorZ = u.z; u.stuck = 0; }
  else if (u.o === 2) { u.o = 0; u.am = false; u.spdCap = 0; u.anchorX = u.x; u.anchorZ = u.z; u.stuck = 0; }
}
function healTick(u, dt) {
  const T = u.T; u.healT -= dt;
  if (u.healT <= 0) {
    u.healT = .4; const out = []; hashQ(u.x, u.z, 34, out); let best = null, bd = 1e9;
    for (const e of out) { if (e === u || e.team !== u.team || e.T.cls !== 0 || e.hp >= e.maxHp - .5) continue; const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < bd) { bd = d; best = e; } }
    u.healTgt = best;
  }
  const h = u.healTgt; if (h && !h.dead && h.hp < h.maxHp) {
    const d = Math.hypot(h.x - u.x, h.z - u.z);
    if (d < 11) { const amt = T.heal * (1 + P(u.owner).mod.heal) * dt; h.hp = Math.min(h.maxHp, h.hp + amt); giveXp(u, amt * .35); u.aim = turnTo(u.aim, Math.atan2(h.x - u.x, h.z - u.z), 9, dt); if (u.o === 0) { u.vx *= .7; u.vz *= .7; } }
    else if (u.o === 0 || u.o === 2) { moveTo(u, h.x, h.z, dt, 8); }
  }
}
function engTick(u, dt) {
  u.healT -= dt;
  if (u.healT <= 0) {
    u.healT = .5; const T = u.T; let best = null, bd = 1e9; const M = W.M;
    for (const b of W.bld) { if (b.team !== u.team || b.dead) continue; if (b.hp >= b.maxHp - 1 && b.prog >= 1 && !b.upg) continue; const d = Math.hypot(b.x - u.x, b.z - u.z); if (d < 36 && d < bd) { bd = d; best = b; } }
    const out = []; hashQ(u.x, u.z, 28, out);
    for (const e of out) { if (e === u || e.team !== u.team || e.T.cls < 1 || e.hp >= e.maxHp - 1) continue; const d = Math.hypot(e.x - u.x, e.z - u.z) * (T.mech ? .4 : 1); if (d < bd) { bd = d; best = e; } }   // mechanics go for vehicles first
    u.rep = best;
  }
  const r = u.rep; if (r && !r.dead && (r.hp < r.maxHp - .5 || (r.k === 'b' && (r.prog < 1 || r.upg)))) {
    const d = Math.hypot(r.x - u.x, r.z - u.z) - (r.k === 'b' ? r.sz * .5 : 1);
    if (d < 6) { if (r.hp < r.maxHp) r.hp = Math.min(r.maxHp, r.hp + (u.T.rep || 14) * dt); u.aim = turnTo(u.aim, Math.atan2(r.x - u.x, r.z - u.z), 9, dt); u.repairing = .3; if (u.o === 0) { u.vx *= .7; u.vz *= .7; } }
    else if (u.o === 0) moveTo(u, r.x, r.z, dt, 4);
  }
}
function nestBuild(u) {
  const p = P(u.owner); let n = 0; for (const b of W.bld) if (b.owner === u.owner && b.type === 'nest') n++;
  if (n >= 10 || p.nestT > W.t || (p.sup < BT.nest.cost[0] && !W.o.sandbox)) { if (u.owner === ME) alertMsg(u.owner, 'nonest', u.x, u.z, 0, ''); return; }
  if (!W.o.sandbox) p.sup -= BT.nest.cost[0]; p.nestT = W.t + 8;
  const q = snapFree(W.M, u.tx, u.tz, 3); const b = placeBuilding('nest', u.owner, { id: -1, x: q[0], z: q[1], slots: [] }, -1, false); b.pt = -1; b.x = q[0]; b.z = q[1]; b.y = W.M.H(q[0], q[1]); b.rot = u.rot;
}

