// ---------------- commands ----------------
// 3.0 ships: spread a group on the water around the deep-water spot nearest the target
function shipOrder(sh, x, z, am) {
  const M = W.M, w = snapWater(M, x, z, 80); if (!w) return;
  sh.forEach((u, i) => { const a = i * 2.4, r = i ? 3.2 + Math.sqrt(i) * 3.4 : 0; const q = snapWater(M, w[0] + Math.cos(a) * r, w[1] + Math.sin(a) * r, 24) || w;
    u.guard = null; u.o = am ? 2 : 1; u.am = am; u.tx = q[0]; u.tz = q[1]; u.tid = 0; u.tgt = null; u.arr = 2; u.spdCap = 0; u.stuck = 0; u.unst = 0; u.wpT = 0; u.los = false; u.losT = 0; u.unl = null; });
}
// the nearest beach a ship can reach from where it is (water next to land), by a search over the water
let _shq = new Int32Array(0), _shv = new Uint8Array(0);
function shoreFrom(M, x, z) {
  const n = M.navW; if (!n || !n.shore) return null; const N = n.nx * n.nz; if (_shq.length < N) { _shq = new Int32Array(N); _shv = new Uint8Array(N); } _shv.fill(0, 0, N);
  let s0 = n.idx(x, z); if (n.blk[s0]) { const w = snapWater(M, x, z, 20); if (!w) return null; s0 = n.idx(w[0], w[1]); }
  let h = 0, t = 0; _shq[t++] = s0; _shv[s0] = 1;
  while (h < t) { const i = _shq[h++]; if (n.shore[i]) return [-M.hw + (i % n.nx + .5) * n.cs, -M.hd + (((i / n.nx) | 0) + .5) * n.cs]; const cx = i % n.nx, cz = (i / n.nx) | 0; for (let k = 0; k < 8; k += 2) { const a = cx + NB[k][0], b = cz + NB[k][1]; if (a < 0 || b < 0 || a >= n.nx || b >= n.nz) continue; const j = b * n.nx + a; if (n.blk[j] || _shv[j]) continue; _shv[j] = 1; _shq[t++] = j; } }
  return null;
}
function cargoPop(t) { let n = 0; if (t.cargo) for (const c of t.cargo) n += c.T.pop; return n; }
// a soldier steps aboard: it leaves the map (marked dead so nothing keeps shooting at it) and rides in the craft
function craftLoad(t, u) {
  const i = W.units.indexOf(u); if (i >= 0) { W.units[i] = W.units[W.units.length - 1]; W.units.pop(); } W.byId.delete(u.id);
  u.dead = true; u.inCraft = t.id; u.o = 0; u.tgt = null; u.vx = u.vz = 0; u.guard = null; (t.cargo = t.cargo || []).push(u); ev([1, 1, r1(u.x), r1(u.y + .4), r1(u.z), 1]);
  if (u.owner === ME && t.cargo.length === 1) alertMsg(u.owner, 'msg', t.x, t.z, 1, 'Soldiers are boarding the ' + t.T.n + '. Click a beach to land them.');
}
// everyone aboard goes ashore around the nearest land and heads for (gx, gz)
function unloadCraft(t, gx, gz) {
  const M = W.M, L = landNear(M, t.x, t.z, 9); if (!L || !t.cargo || !t.cargo.length) return false; let k = 0;
  for (const u of t.cargo.splice(0)) {
    if (!u.inCraft) continue; const a = k * 2.4 + t.id, r = k ? 1.2 + Math.sqrt(k) * 1.5 : 0, q = landNear(M, L[0] + Math.cos(a) * r, L[1] + Math.sin(a) * r, 6) || L; k++;
    u.dead = false; u.inCraft = 0; u.x = u.px = u.rx = q[0]; u.z = u.pz = u.rz = q[1]; u.y = M.H(q[0], q[1]); u.vx = u.vz = 0; u.ghost = 2; u.fromBoat = t.id; u.o = 0; u.am = false; u.anchorX = u.x; u.anchorZ = u.z; u.stuck = 0; u.unst = 0; u.wpT = 0; u.los = false; u.losT = 0; u.tgt = null;
    if (gx !== undefined && Math.hypot(gx - u.x, gz - u.z) > 7) { u.o = 2; u.am = true; u.tx = gx + (Math.random() - .5) * 5; u.tz = gz + (Math.random() - .5) * 5; u.arr = 2; }
    W.units.push(u); W.byId.set(u.id, u);
  }
  t.unl = null; ev([1, 1, r1(L[0]), r1(M.H(L[0], L[1]) + .5), r1(L[1]), 1]); if (t.owner === ME) alertMsg(t.owner, 'msg', L[0], L[1], 1, k + ' soldier' + (k === 1 ? '' : 's') + ' landed.'); return true;
}
function boardTick(u, dt) {
  const t = W.byId.get(u.tid); if (!t || t.dead || t.owner !== u.owner || cargoPop(t) + u.T.pop > t.T.carry) { u.o = 0; u.anchorX = u.x; u.anchorZ = u.z; return; }
  if (Math.hypot(t.x - u.x, t.z - u.z) < t.T.r + 6) { craftLoad(t, u); return; }
  moveTo(u, t.x, t.z, dt, 1); u.boardT += dt; if (u.boardT > 50) { u.o = 0; u.anchorX = u.x; u.anchorZ = u.z; }   // never got close: give up
}
function unitsOf(pid, ids) { const r = []; for (const id of ids) { const u = W.byId.get(id); if (u && u.k === 'u' && u.owner === pid && !u.dead) r.push(u); } return r; }
// 2.2 formations: soldiers in front, vehicles behind them, artillery and support at the back, each with spacing that fits
// its size; every shape has a size cap so a huge army stays a compact block instead of covering the map
function formationPositions(us, tx, tz, form) {
  const n = us.length, M = W.M; let cx = 0, cz = 0; for (const u of us) { cx += u.x; cz += u.z; } cx /= n; cz /= n;
  let fx = tx - cx, fz = tz - cz; const fl = Math.hypot(fx, fz); if (fl < 1) { fx = 0; fz = 1; } else { fx /= fl; fz /= fl; }
  const rx = fz, rz = -fx, snap = (x, z) => snapFree(M, clamp(x, -M.hw + 3, M.hw - 3), clamp(z, -M.hd + 3, M.hd - 3), 4);
  if (form === 'free') {   // keep the shape the group already has, squeezed if it is spread out too far
    let mr = 0; for (const u of us) mr = Math.max(mr, Math.hypot(u.x - cx, u.z - cz)); const lim = 4 + Math.sqrt(n) * 1.25, k = mr > lim ? lim / mr : 1;
    return us.map(u => snap(tx + (u.x - cx) * k, tz + (u.z - cz) * k));
  }
  const spread = form === 'spread' ? 1.7 : 1;
  const wid = u => (u.T.air ? 3 : u.T.cls === 0 ? 1.9 : Math.max(3, u.T.r * 2 + .6)) * spread;
  const pri = u => { const T = u.T, w = T.w || T.w2; if (T.heal || T.eng || T.mech || (w && w.minr)) return 3; if (T.air) return 2; return T.cls === 0 ? 0 : 1; };
  const lat = u => (u.x - cx) * rx + (u.z - cz) * rz;
  const order = us.map((u, i) => i).sort((a, b) => pri(us[a]) - pri(us[b]) || Math.hypot(us[a].x - tx, us[a].z - tz) - Math.hypot(us[b].x - tx, us[b].z - tz));
  let avg = 0; for (const u of us) avg += wid(u); avg /= n;
  const res = new Array(n);
  if (form === 'ring') {   // rings around the spot, outer ring first, support in the middle; never wider than ~30 m
    let area0 = 0; for (const u of us) area0 += wid(u) * wid(u); let R = clamp(Math.sqrt(area0) * .62, 5, 28), k = 0; const rings = [];
    while (k < n) { const cap = Math.max(4, Math.floor(TAU * R / avg)); rings.push([R, Math.min(cap, n - k)]); k += cap; R = Math.max(2.5, R - avg * 1.1); if (R <= 2.5 && k < n) { rings.push([2.5, n - k]); break; } }
    k = 0; for (const [Rr, c] of rings) for (let j = 0; j < c && k < n; j++, k++) { const a = j / c * TAU + (Rr * .37); res[order[k]] = snap(tx + Math.cos(a) * Rr, tz + Math.sin(a) * Rr); }
    return res;
  }
  // rows from the front (at the target) to the back
  // row width in metres, from the area the whole group really needs (so 600 troops make a ~70 m block, not a quarter of the map)
  let area = 0; for (const u of us) area += wid(u) * wid(u); const side = Math.sqrt(area);
  const rowW = r => form === 'line' ? clamp(side * 3, 12, 110) : form === 'column' ? clamp(side * .65, 4, 50) : form === 'wedge' ? Math.min((2 * r + 1) * avg, clamp(side * 1.5, 8, 90)) : clamp(side * 1.25, 8, form === 'spread' ? 130 : 85);
  const rows = []; let row = [], rp = -1, rw = 0;
  for (const i of order) { const p = pri(us[i]), w = wid(us[i]); if (row.length && (rw + w > rowW(rows.length) + .01 || p !== rp)) { rows.push(row); row = []; rw = 0; } row.push(i); rw += w; rp = p; }
  if (row.length) rows.push(row);
  let depth = 0;
  for (const r of rows) {
    r.sort((a, b) => lat(us[a]) - lat(us[b]));   // keep left units on the left, so paths do not cross
    let tw = 0, dep = 2; for (const i of r) { tw += wid(us[i]); dep = Math.max(dep, wid(us[i])); }
    let x = -tw / 2; for (const i of r) { const w = wid(us[i]); const ox = x + w / 2; x += w; res[i] = snap(tx + rx * ox - fx * (depth + dep / 2), tz + rz * ox - fz * (depth + dep / 2)); }
    depth += dep * .95;
  }
  return res;
}
function applyCmd(pid, c) {
  const p = W.players[pid]; if (!p || (!p.alive && !W.o.sandbox)) return false; const M = W.M;
  switch (c.k) {
    case 'mv': case 'am': {
      const us = unitsOf(pid, c.ids).filter(u => !u.T.nobuild || true); if (!us.length) return false;
      const x = clamp(+c.x, -M.hw + 3, M.hw - 3), z = clamp(+c.z, -M.hd + 3, M.hd - 3);
      if (!isFinite(x) || !isFinite(z)) return false;
      const sh = us.filter(u => u.T.naval), gr = sh.length ? us.filter(u => !u.T.naval) : us;   // 3.0: ships form up on the water, everyone else on land
      if (sh.length) shipOrder(sh, x, z, c.k === 'am');
      const pos = gr.length === 1 ? [snapFree(M, x, z, 4)] : gr.length ? formationPositions(gr, x, z, FORMS[c.f | 0] || 'box') : [];
      let minSpd = 99; if (c.g) for (const u of gr) if (!u.T.air) minSpd = Math.min(minSpd, unitSpeed(u));
      gr.forEach((u, i) => { u.guard = null; u.o = c.k === 'am' ? 2 : 1; u.am = c.k === 'am'; u.tx = pos[i][0]; u.tz = pos[i][1]; u.tid = 0; u.tgt = null; u.arr = 1.2 + Math.min(3, us.length * .08); u.spdCap = c.g && !u.T.air && minSpd < 99 ? minSpd : 0; u.stuck = 0; u.unst = 0; u.wpT = 0; u.los = false; u.losT = 0; });
      return true;
    }
    case 'atk': {
      const us = unitsOf(pid, c.ids); const t = W.byId.get(c.t); if (!us.length || !t || t.dead || t.team === p.team) return false;
      for (const u of us) { u.guard = null; if (!u.T.w && !u.T.w2) { u.o = 1; u.tx = t.x; u.tz = t.z; continue; } u.o = 3; u.tid = t.id; u.tgt = t; u.am = false; u.spdCap = 0; } return true;
    }
    case 'stop': for (const u of unitsOf(pid, c.ids)) { u.guard = null; u.o = 0; u.tgt = null; u.am = false; u.spdCap = 0; u.anchorX = u.x; u.anchorZ = u.z; } return true;
    case 'hold': for (const u of unitsOf(pid, c.ids)) { u.guard = null; u.o = 4; u.tgt = null; u.vx = u.vz = 0; } return true;
    case 'guard': {   // 4.2: hold a spot: troops ring it, chase off attackers, then walk back to their posts
      const us0 = unitsOf(pid, c.ids).filter(u => u.T.w || u.T.w2 || u.T.heal || u.T.eng); if (!us0.length) return false; const x = clamp(+c.x, -M.hw + 3, M.hw - 3), z = clamp(+c.z, -M.hd + 3, M.hd - 3); if (!isFinite(x) || !isFinite(z)) return false;
      const sh = us0.filter(u => u.T.naval), us = us0.filter(u => !u.T.naval);   // 3.0: ships guard the water nearest the spot
      if (sh.length) { shipOrder(sh, x, z, true); for (const u of sh) u.guard = [u.tx, u.tz, u.tx, u.tz]; } if (!us.length) return true;
      const pos = us.length === 1 ? [snapFree(M, x, z, 4)] : formationPositions(us, x, z, 'ring');
      us.forEach((u, i) => { u.guard = [pos[i][0], pos[i][1], x, z]; u.o = 2; u.am = true; u.tx = pos[i][0]; u.tz = pos[i][1]; u.tid = 0; u.tgt = null; u.arr = 1.5; u.spdCap = 0; u.stuck = 0; u.unst = 0; u.wpT = 0; u.los = false; u.losT = 0; });
      return true;
    }
    case 'board': {   // 3.0: soldiers walk to a Landing Craft and climb aboard; the craft comes to the beach nearest them
      const t = W.byId.get(c.t); if (!t || t.dead || t.owner !== pid || !t.T.carry) return false;
      const us = unitsOf(pid, c.ids).filter(u => u.T.cls === 0 && !u.T.air); if (!us.length) return false;
      let cx = 0, cz = 0; for (const u of us) { cx += u.x; cz += u.z; u.guard = null; u.o = 7; u.tid = t.id; u.tgt = null; u.am = false; u.spdCap = 0; u.stuck = 0; u.unst = 0; u.wpT = 0; u.los = false; u.losT = 0; u.arr = 1; u.boardT = 0; } cx /= us.length; cz /= us.length;
      const w = snapWater(M, cx, cz, 70); if (w && Math.hypot(w[0] - t.x, w[1] - t.z) > 6 && Math.hypot(cx - t.x, cz - t.z) > 12) { t.o = 1; t.tx = w[0]; t.tz = w[1]; t.arr = 1.5; t.unl = null; t.guard = null; t.tgt = null; t.stuck = 0; t.unst = 0; t.wpT = 0; t.los = false; t.losT = 0; }
      return true;
    }
    case 'unload': {   // 3.0: a Landing Craft sails to the beach nearest the spot (or the nearest beach at all) and puts its soldiers ashore
      let ok = false; const has = c.x !== undefined && isFinite(+c.x) && isFinite(+c.z), gx = has ? clamp(+c.x, -M.hw + 3, M.hw - 3) : 0, gz = has ? clamp(+c.z, -M.hd + 3, M.hd - 3) : 0;
      for (const t of unitsOf(pid, c.ids)) {
        if (!t.T.naval) continue; ok = true;
        if (!t.T.carry || !t.cargo || !t.cargo.length) { if (has) shipOrder([t], gx, gz, false); continue; }   // nothing aboard: just sail there
        const w = has ? snapWater(M, gx, gz, 90) : shoreFrom(M, t.x, t.z); t.unl = has ? { x: gx, z: gz } : { here: 1 }; t.unlT = 0;
        if (w) { t.o = 1; t.tx = w[0]; t.tz = w[1]; t.arr = 2.2; t.guard = null; t.tgt = null; t.stuck = 0; t.unst = 0; t.wpT = 0; t.los = false; t.losT = 0; }
      }
      return ok;
    }
    case 'tp': { const v = clamp(c.v | 0, 0, 4); for (const u of unitsOf(pid, c.ids)) { u.tp = v; u.scan = 0; } return true; }
    case 'nest': { const us = unitsOf(pid, c.ids).filter(u => u.T.eng); if (!us.length) return false; const u = us.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0]; u.o = 5; u.tx = +c.x; u.tz = +c.z; u.stuck = 0; return true; }
    case 'repall': { let cost = 0; const bs = W.bld.filter(b => b.owner === pid && !b.dead && b.prog >= 1 && b.hp < b.maxHp - .5); for (const b of bs) cost += (b.maxHp - b.hp) * .3; cost = Math.ceil(cost); if (!bs.length || (p.sup < cost && !W.o.sandbox)) return false; p.sup -= cost; for (const b of bs) b.hp = b.maxHp; ev([3, pid, 'msg', 0, 0, 1, bs.length + ' buildings repaired for ' + cost + '.']); return true; }
    case 'rally': { const b = W.byId.get(c.b); if (!b || b.owner !== pid) return false; if (c.clear) { b.hasRally = false; return true; } b.hasRally = true; b.rx = clamp(+c.x, -M.hw + 3, M.hw - 3); b.rz = clamp(+c.z, -M.hd + 3, M.hd - 3); return true; }
    case 'build': return cmdBuild(p, c);
    case 'upg': return cmdUpgrade(p, c);
    case 'spec': return cmdSpec(p, c);
    case 'ros': return cmdRoster(p, c);
    case 'rhold': { const b = W.byId.get(c.b); if (!b || b.owner !== pid || !b.ros) return false; b.hold = !b.hold; if (b.hold) refundTraining(b); NET.dirty = true; return true; }
    case 'sell': { const b = W.byId.get(c.b); if (!b || b.owner !== pid || b.type === 'hq') return false; p.sup += Math.round(b.spent * .5); ev([1, 2, r1(b.x), r1(b.y + 1), r1(b.z), 1]); killBuilding(b, null, -1); return true; }
    case 'tech': return cmdTech(p, c);
    case 'call': return cmdCall(p, c);
    case 'dbg': return cmdDebug(p, c);
    case 'chat': ev([11, pid, String(c.m || '').slice(0, 80)]); return true;
  }
  return false;
}
function cmdBuild(p, c) {
  const pt = W.pts[c.pt]; if (!pt || pt.owner !== p.id) return false; const T = BT[c.type]; if (!T || BUILDABLE.indexOf(c.type) < 0) return false; if ((T.hq1 || 1) > playerHQLvl(p) && !W.o.sandbox) return false;
  const cost = bCost(p, c.type, 0);
  if (c.type === 'wall') { if (pt.wall) return false; } else { const sl = pt.slots[c.slot | 0]; if (!sl || sl.b || (sl.d && !T.def) || !sl.sea !== !T.sea) return false; }
  if (T.max && bCount(p, c.type) >= T.max && !W.o.sandbox && !W.o.war) return false;
  if (p.sup < cost && !W.o.sandbox) return false;
  if (!W.o.sandbox) p.sup -= cost;
  const b = placeBuilding(c.type, p.id, pt, c.type === 'wall' ? -2 : c.slot | 0, false); b.spent = cost; if (c.type === 'wall') b.slot = -2;
  return true;
}
function bCost(p, type, i) { const c = BT[type].cost[i]; return p && p.bldDisc ? Math.round(c * (1 - p.bldDisc)) : c; }   // 3.0 Contractors perk
function cmdUpgrade(p, c) {
  const b = W.byId.get(c.b); if (!b || b.owner !== p.id || b.prog < 1 || b.upg || b.lvl >= 3 || !BT[b.type].cost[b.lvl]) return false;
  const cost = bCost(p, b.type, b.lvl); let c2 = cost; if (b.pt >= 0) { const pt = W.pts[b.pt]; for (const sl of pt.slots) if (sl.b && sl.b.type === 'depot' && sl.b.spec === 'logistics' && sl.b.prog >= 1) { c2 = Math.round(cost * .9); break; } }
  if (b.lvl === 2 && b.type !== 'hq' && playerHQLvl(p) < 2) return false;
  if (p.sup < c2 && !W.o.sandbox) return false; if (!W.o.sandbox) p.sup -= c2;
  b.spent += c2; b.upg = { kind: 'lvl', t: 0, dur: BT[b.type].bt[b.lvl] }; return true;
}
function cmdSpec(p, c) {
  const b = W.byId.get(c.b); if (!b || b.owner !== p.id || b.prog < 1 || b.upg || b.lvl < 3 || b.spec) return false;
  const sp = BT[b.type].specs.find(s => s.id === c.s); if (!sp) return false; if (p.sup < SPEC_COST && !W.o.sandbox) return false; if (!W.o.sandbox) p.sup -= SPEC_COST;
  b.spent += SPEC_COST; b.upg = { kind: 'spec', spec: sp.id, t: 0, dur: SPEC_TIME }; return true;
}
function canTrainAt(b, type) {
  const T = UT[type]; if (!T || T.nobuild || b.prog < 1) return false; if (facOfT(T) !== (P(b.owner).fac | 0)) return false;   // 3.0: each army trains only its own troops
  for (const s of T.src) if (s[0] === b.type && b.lvl >= s[1] && (!s[2] || b.spec === s[2])) return true; return false;
}
function unitsForB(b) { const r = []; for (const k in UT) if (canTrainAt(b, k)) r.push(k); return r; }
function unlockInfo(b, type) { const T = UT[type]; for (const s of T.src) if (s[0] === b.type) { return s; } return null; }
// c.d = +1 adds a slot for troop c.u, -1 removes one (the troop itself stays, it just will not be replaced)
function cmdRoster(p, c) {
  const b = W.byId.get(c.b); if (!b || b.owner !== p.id || !b.ros || !UT[c.u]) return false; const d = c.d | 0;
  if (d > 0) {
    if (!canTrainAt(b, c.u) || !rosFits(b, c.u)) return false; const cost = W.o.sandbox ? 0 : slotCost(p, c.u, b); if (p.sup < cost) return false;
    p.sup -= cost; b.spent += cost; b.paid[c.u] = (b.paid[c.u] || 0) + cost; b.ros[c.u] = (b.ros[c.u] || 0) + 1;
  } else if (d < 0) {     // half the slot's price back; the troop itself stays until it dies
    const n = b.ros[c.u]; if (!n) return false; const avg = (b.paid[c.u] || 0) / n; b.paid[c.u] = (b.paid[c.u] || 0) - avg; b.spent -= avg; p.sup += Math.round(avg * .5);
    if (--b.ros[c.u] <= 0) delete b.ros[c.u]; b.made[c.u] = Math.min(b.made[c.u] || 0, b.ros[c.u] || 0); if (b.tr && b.tr.u === c.u && rosHave(b, c.u) >= (b.ros[c.u] || 0)) refundTraining(b);
  }
  else return false;
  NET.dirty = true; return true;
}
function deployUnit(b, p, type) {
  const u = spawnFromBuilding(b, type, rosHave(b, type) % 3); p.deployT = W.t; ev([1, 1, r1(u.x), r1(u.y + 1), r1(u.z), 1]);
  return u;
}
// 3.1: each side may research at most 5 Upgrades per battle (Sandbox has no limit). Upgrades kept from earlier battles of
// an Endless War do not count; the limit is on new ones.
const TECH_PER_ROUND = 5;
function techLeft(p) { return W.o.sandbox ? 99 : Math.max(0, TECH_PER_ROUND - (p.techN || 0)); }
function cmdTech(p, c) {
  const t = TECHBY[c.id]; if (!t || p.techs[t.id] || p.res || !techList(p.fac).includes(t) || techLeft(p) <= 0) return false; const hq = playerHQLvl(p);
  if (hq < Math.max(2, t.tier) && !W.o.sandbox) return false; if (t.tier > 1) { const prev = techPrev(t, p.fac); if (!prev || !p.techs[prev.id]) return false; }
  if (p.sup < t.cost && !W.o.sandbox) return false; if (!W.o.sandbox) p.sup -= t.cost; p.res = { id: t.id, t: 0, dur: t.time }; p.techN = (p.techN || 0) + 1; return true;
}
function callCd(p, id) { const C = CALL[id]; let cd = C.cd * (1 + p.mod.callCd); if (id === 'air' || id === 'recon') for (const b of W.bld) if (b.owner === p.id && b.type === 'radar' && b.spec === 'aircon' && b.prog >= 1) { cd *= .6; break; } return Math.max(8, cd); }
function callCost(p, id) { return Math.round(CALL[id].cost * (1 + p.mod.callCost)); }
function callAvail(p, id) { const C = CALL[id]; if (C.req[0] === 'hq') return playerHQLvl(p) >= C.req[1]; return playerHQLvl(p) >= 2 && bestLvl(p, C.req[0]) >= C.req[1]; }
function hasAircon(p) { for (const b of W.bld) if (b.owner === p.id && b.type === 'radar' && b.spec === 'aircon' && b.prog >= 1) return true; return false; }
function cmdCall(p, c) {
  const C = CALL[c.id]; if (!C || (!callAvail(p, c.id) && !W.o.sandbox)) return false; if ((p.cd[c.id] || 0) > 0) return false;
  const cost = callCost(p, c.id); if (p.sup < cost && !W.o.sandbox) return false;
  const M = W.M; let x = clamp(+c.x, -M.hw + 4, M.hw - 4), z = clamp(+c.z, -M.hd + 4, M.hd - 4); if (!isFinite(x) || !isFinite(z)) return false;
  if ((c.id === 'para' || c.id === 'merc' || c.id === 'armor') && W.o.fog && !seen(p.team, x, z)) return false;
  if (C.fogOnly && !W.o.fog) return false;
  if (!W.o.sandbox) p.sup -= cost; p.cd[c.id] = callCd(p, c.id); p.stats.calls++; W.stats.calls++;
  const hq = p.hqB; const hx = hq ? hq.x : 0, hz = hq ? hq.z : 0;
  switch (c.id) {
    case 'recon': { let dx = x - hx, dz = z - hz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; ev([4, 0, r1(x - dx * 90), r1(z - dz * 90), r1(x + dx * 90), r1(z + dz * 90), 3.5]); W.sched.push({ at: W.t + 1.6, fn: () => { W.reveals.push({ team: p.team, x, z, r: 44, t: 22 }); ev([6, r1(x), r1(z), 44, 0, p.id]); } }); break; }
    case 'merc': case 'para': case 'armor': {
      const list = (c.id === 'merc' ? ['merc', 'merc', 'merc', 'merc'] : c.id === 'para' ? ['rifleman', 'rifleman', 'rifleman', 'rifleman', 'rifleman', 'medic'] : ['tank', 'tank']).map(t => fu(p, t));   // 3.0: the Legion gets Legionaries / Warmechs
      const dly = c.id === 'armor' ? 4 : 2.6; ev([5, (c.id === 'armor' ? 1 : 0) | (p.fac === 1 && c.id !== 'merc' ? 2 : 0), r1(x), r1(z), dly, list.length]);   // bit 2 (3.0): Legion drop pods instead of parachutes
      W.sched.push({ at: W.t + dly, fn: () => { list.forEach((t, i) => { const a = i / list.length * TAU, d = list.length > 3 ? 4.5 : 3; const q = snapFree(M, x + Math.cos(a) * d, z + Math.sin(a) * d, 5); if (p.pop + UT[t].pop > p.popCap && !W.o.sandbox) return; const u = spawnUnit(t, p.id, q[0], q[1], { rot: a, vet: t === 'merc' ? 1 : 0, life: t === 'merc' ? 120 : 0 }); if (t === 'merc') { refreshUnit(u); u.hp = u.maxHp; } ev([1, 1, r1(q[0]), r1(M.H(q[0], q[1])), r1(q[1]), 1]); }); } });
      break;
    }
    case 'air': {
      let dx = x - hx, dz = z - hz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const n = 6 + (hasAircon(p) ? 3 : 0);
      ev([4, 1, r1(x - dx * 100), r1(z - dz * 100), r1(x + dx * 100), r1(z + dz * 100), 3.2]);
      for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * 6, bx = x + dx * t, bz = z + dz * t; W.sched.push({ at: W.t + 1.3 + i * .22, fn: () => { const pr = { sx: bx - dx * 4, sy: 40, sz: bz - dz * 4, tx: bx, ty: M.H(bx, bz), tz: bz, t0: W.t, dur: .9, src: null, owner: p.id, team: p.team, dmg: 140, wt: 'bomb', spl: 8, tid: 0, arc: 0, k: 3 }; W.proj.push(pr); ev([0, 3, r1(pr.sx), 40, r1(pr.sz), r1(bx), r1(pr.ty), r1(bz), .9, 0, 0]); } }); }
      break;
    }
    case 'barrage': {
      for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 22, bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r; W.sched.push({ at: W.t + 1.5 + i * .5, fn: () => { const sx = bx + (hx - bx) * .5, sz = bz + (hz - bz) * .5; const pr = { sx, sy: 70, sz, tx: bx, ty: M.H(bx, bz), tz: bz, t0: W.t, dur: 1.5, src: null, owner: p.id, team: p.team, dmg: 80, wt: 'shell', spl: 6.5, tid: 0, arc: 1, k: 2 }; W.proj.push(pr); ev([0, 2, r1(sx), 70, r1(sz), r1(bx), r1(pr.ty), r1(bz), 1.5, 0, 1]); } }); }
      ev([6, r1(x), r1(z), 24, 1]); break;
    }
    case 'supply': {
      ev([5, 0, r1(x), r1(z), 2.2, 3]);
      W.sched.push({ at: W.t + 2.3, fn: () => {
        ev([6, r1(x), r1(z), 28, 2]);
        for (const u of W.units) if (u.team === p.team && Math.hypot(u.x - x, u.z - z) < 28) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .6); u.shield = 8; }
        for (const b of W.bld) if (b.team === p.team && Math.hypot(b.x - x, b.z - z) < 28) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * .4);
      } });
      break;
    }
    case 'cruise': {
      ev([0, 10, r1(hx), 120, r1(hz), r1(x), r1(M.H(x, z)), r1(z), 3.5, 0, 1]);
      W.sched.push({ at: W.t + 3.5, fn: () => { splashDmg(x, z, 22, 950, 'bomb', p.team, p.id, null, {}); ev([1, 4, r1(x), r1(M.H(x, z) + 2), r1(z), 0]); for (let k = 0; k < 6; k++) ev([1, 3, r1(x + rr(-9, 9)), r1(M.H(x, z) + 1), r1(z + rr(-9, 9)), 0]); } });
      break;
    }
  }
  return true;
}
function cmdDebug(p, c) {
  if (!W.o.sandbox && !W.o.debug) return false;
  if (c.what === 'unit') { let x = c.x, z = c.z; if (UT[c.type] && UT[c.type].naval) { const w = snapWater(W.M, x, z, 40); if (!w) return false; x = w[0]; z = w[1]; } const u = spawnUnit(c.type, c.owner === undefined ? p.id : c.owner, x, z, { vet: c.vet || 0 }); return !!u; }   // 3.0: ships only on water
  if (c.what === 'sup') { p.sup += c.n; return true; }
  return false;
}
// =====================================================================
//  AI COMMANDERS
// =====================================================================
function makeAI(p, cfg) {
  const pers = cfg.persObj || AIP[cfg.pers] || AIP.hale, dif = Object.assign({}, AID[cfg.diff] || AID.normal, cfg.over || {});   // 3.0: missions can tune a commander
  const SAYS = { vex: { start: 'Hit them hard, hit them fast!', attack: 'Charge! No mercy!', retreat: 'Regroup! We go again.' }, stone: { start: 'Dig in. Let them come.', attack: 'The wall advances.', retreat: 'Fall back behind the guns.' }, hale: { start: 'Adapting to the battlefield.', attack: 'Probing their weak point.', retreat: 'Recalculating.' }, kruger: { start: 'Armor will decide this.', attack: 'Tanks forward!', retreat: 'Pull back and repair.' }, voss: { start: 'The skies belong to us.', attack: 'Wings up. Strike!', retreat: 'Back to the airfield.' }, kael: { start: 'Shields up. The Legion advances.', attack: 'Mechs forward!', retreat: 'Fall back and recharge shields.' } };
  const ai = {
    say(kind) { if (W.o.tutorial || W.o.demo || W.o.war || this.t - (this.lastSay || -99) < 50 || this.t < 4) return; const lc = LORE.commanders[pers.id]; let s = (SAYS[pers.id] || {})[kind]; if (lc && (kind !== 'start' || Math.random() < .6)) s = kind === 'start' ? lc.taunt : lc.quotes[(Math.random() * lc.quotes.length) | 0]; if (!s) return; this.lastSay = this.t; ev([11, p.id, s]); },
    p, pers, dif, diff: cfg.diff, persId: pers.id, t: 0, thinkT: 1 + Math.random() * 2, state: 'mass', wave: 0, role: new Map(), tgtPt: -1, stagePt: -1, startPower: 1, lastBuild: 0, atkStart: 0, tok: 2, tokCap: 2 + dif.apm / 20, focus: 'build', focusT: -99, nextAtk: dif.firstAtk || 300, threatSince: new Map(), gatherT: 0, caps: new Map(), wants: new Map(), s: null, lastRetreat: -99, nestT: 0, lastThreat: -99,
    update(dt) { if (this.hold) return; this.t += dt; this.tok = Math.min(this.tokCap, this.tok + dt * dif.apm / 60); if (this.t < (dif.startDelay || 0)) return; if ((this.thinkT -= dt) <= 0) { this.thinkT = dif.think * (.8 + Math.random() * .4); try { this.think(); } catch (e) { if (!this.err) { this.err = 1; console.error('AI error', e); } } } },
    // a human can only do so many things per minute: every real command spends an action point (setting a rally point is free)
    cmd(c) { if (c.k !== 'rally') { if (this.tok < 1) return false; const r = applyCmd(p.id, c); if (r) this.tok -= 1; return r; } return applyCmd(p.id, c); },
    ord(us, kind, x, z) { if (!us.length) return; this.cmd({ k: kind, ids: us.map(u => u.id), x, z, f: us.length > 4 ? (Math.random() < .3 ? 3 : 0) : 0 }); },
    think() {
      if (!p.alive) return; if (this.t > 6 && !this.sStart) { this.sStart = 1; this.say('start'); } this.survey(); if (Math.random() < dif.mistakes * .5) return;
      if (Math.random() < (dif.idle || 0)) return;          // looked away / thinking about something else
      this.pickFocus();
      const f = this.focus;
      if (f === 'build' || f === 'expand' || Math.random() < .15) this.econ(); else this.saveFor = 0;
      this.produce(); this.military(); this.fleet(); this.events(); this.calls();
    },
    // a person does one or two things at a time: expand, or build up, or mass an army, or defend, or attack
    pickFocus() {
      const s = this.s;
      if (this.urgent) { this.focus = 'defend'; this.focusT = this.t; return; }
      if (this.state === 'gather' || this.state === 'attack') { this.focus = 'attack'; this.focusT = this.t; return; }
      if (this.focus === 'defend' || this.focus === 'attack') this.focusT = -99;
      if (this.t - this.focusT < dif.focusDwell * (.8 + Math.random() * .6)) return;
      const hql = playerHQLvl(p), nb = Object.keys(s.blds).reduce((a, k) => a + s.blds[k].length, 0);
      const w = { build: nb < 3 + s.ownPts.length * 2 ? 3 : 1, expand: s.neutral.length && s.ownPts.length < 5 ? 3 : (s.neutral.length ? 1 : 0), mass: 2 + (this.t > (dif.firstAtk || 300) * .5 ? 1 : 0) };
      let sum = w.build + w.expand + w.mass, r = Math.random() * sum, pick = 'build'; for (const k in w) { r -= w[k]; if (r <= 0) { pick = k; break; } }
      this.focus = pick; this.focusT = this.t;
    },
    survey() {
      const s = { my: [], combat: [], eng: [], med: [], scouts: [], air: [], enemy: [], enemyAll: [], mix: [0, 0, 0, 0], mixT: 0, blds: {}, pts: [], oppPts: [], neutral: [], ownPts: [], navy: [], boats: [] };
      for (const u of W.units) {
        if (u.owner === p.id) { s.my.push(u); if (u.T.naval) { if (u.T.carry) s.boats.push(u); else s.navy.push(u); } else if (u.T.eng) s.eng.push(u); else if (u.T.heal) s.med.push(u); else s.combat.push(u); if (u.T.air) s.air.push(u); }   // 3.0: ships are handled by fleet()
        else if (u.team !== p.team) { s.enemyAll.push(u); if (seen(p.team, u.x, u.z)) { s.enemy.push(u); s.mix[u.T.cls] += u.T.cost; s.mixT += u.T.cost; } }
      }
      for (const b of W.bld) if (b.owner === p.id) { (s.blds[b.type] = s.blds[b.type] || []).push(b); }
      for (const pt of W.pts) { if (pt.owner === p.id) s.ownPts.push(pt); else if (pt.owner >= 0 && P(pt.owner).team === p.team) { } else { s.oppPts.push(pt); if (pt.owner < 0) s.neutral.push(pt); } }
      s.nOwn = s.blds; s.enemyBlds = W.bld.filter(b => b.team !== p.team && (b.sb >> p.team & 1));
      s.power = s.combat.reduce((a, u) => a + u.T.cost * (u.hp / u.maxHp), 0);
      this.s = s;
    },
    cntB(type) { return (this.s.blds[type] || []).length; },
    reach(pt) { const hq = p.hqB; return !W.M.naval || !hq || pt.comp === undefined || pt.comp === W.pts[hq.pt].comp; },   // 3.0: can its army walk there (islands need boats)
    // ---------------- economy ----------------
    econ() {
      const s = this.s; const sup = p.sup; const own = s.ownPts; this.saveFor = 0; const saveUp = c => { if (!this.saveFor && c < 700) this.saveFor = c; };
      // pick building
      const lim = Math.max(2, Math.floor(Math.min(pers.bld.length, 3 + own.length * 2) * dif.bldMul)); const need = {}; let want = null, gated = false; const hql = playerHQLvl(p);
      for (let i = 0; i < lim && !want; i++) { const t = pers.bld[i]; if (dif.noDef && (BT[t].def || t === 'wall')) continue; if (BT[t].max && this.cntB(t) >= BT[t].max) continue; need[t] = (need[t] || 0) + 1; if (this.cntB(t) < need[t]) { if ((BT[t].hq1 || 1) > hql) { gated = true; continue; } want = t; } }
      if (!want && W.M.naval && this.t > 70 && this.cntB('shipyard') < (dif.noTech ? 1 : 2) && this.cntB('barracks') >= 1 && own.some(pt => pt.slots.some(sl => sl.sea && !sl.b))) want = 'shipyard';   // 3.0: a Shipyard at its docks
      if (!want && sup > 450 && !dif.noTech && !dif.noDef) { const ex = ['turret', 'depot', 'barracks', 'turret', 'factory', 'farm'][(Math.random() * 6) | 0]; if (this.cntB(ex) < 2 + own.length && !(BT[ex].max && this.cntB(ex) >= BT[ex].max)) want = ex; }
      if (!want && !dif.noDef && sup > 600 && Math.random() < .35) { const dl = ['turret', 'cannon', 'flakt', 'mortarpit'].concat(playerHQLvl(p) >= 2 ? ['tesla', 'shieldgen'] : []), pick = s.mix[3] > s.mixT * .25 ? 'flakt' : s.mix[1] + s.mix[2] > s.mixT * .4 ? 'cannon' : dl[(Math.random() * dl.length) | 0]; let nd = 0; for (const b of W.bld) if (b.owner === p.id && BT[b.type].def) nd++; if (nd < 2 + own.length * 2) want = pick; }
      if (want && (!BT[want].def || (() => { let nd = 0; for (const b of W.bld) if (b.owner === p.id && BT[b.type].def) nd++; return nd < 2 + own.length * 3; })())) { if (sup >= BT[want].cost[0] + (want === 'depot' ? 0 : 20)) this.placeB(want); else saveUp(BT[want].cost[0] + 20); }
      // forward walls on the contested flag (Hard and Expert commanders, and the Defender)
      if (!dif.noTech && sup > 300 && playerHQLvl(p) >= BT.wall.hq1 && Math.random() < .3 * (pers.id === 'stone' ? 2 : 1)) { const fp = this.frontPoint(); if (fp && !fp.wall && own.length >= 2 && p.sup > 400) { if (pers.id === 'stone' || Math.random() < .3) this.cmd({ k: 'build', pt: fp.id, type: 'wall', slot: 0 }); } }
      // upgrades
      let upDone = 0;
      const order = gated ? ['hq', 'depot', 'farm', 'barracks', 'factory', 'shipyard', 'airfield', 'medical', 'radar', 'turret', 'arty', 'cannon', 'flakt', 'mortarpit', 'tesla', 'shieldgen'] : ['depot', 'farm', 'radar', 'barracks', 'factory', 'shipyard', 'airfield', 'medical', 'turret', 'arty', 'cannon', 'flakt', 'mortarpit', 'tesla', 'shieldgen', 'hq'];
      for (const t of order) {
        if (upDone) break;
        for (const b of (t === 'hq' ? [p.hqB] : s.blds[t] || [])) {
          if (!b || b.prog < 1 || b.upg || b.dead) continue;
          if (b.lvl < 3 && BT[t].cost[b.lvl] !== undefined && !(dif.noTech && b.lvl >= 2 && t !== 'hq')) { const c = BT[t].cost[b.lvl]; const res = t === 'hq' ? 260 : 100 + (t === 'turret' || t === 'arty' ? 120 : 0); if (t === 'hq' && own.length < 3) continue; if (b.lvl >= 2 && playerHQLvl(p) < 2 && t !== 'hq') continue; if (sup >= c + res) { if (this.cmd({ k: 'upg', b: b.id })) { upDone = 1; break; } } else { saveUp(c + res); upDone = 1; break; } }
          else if (b.lvl >= 3 && !b.spec && dif.noTech) { }
          else if (b.lvl >= 3 && !b.spec && sup < SPEC_COST + 80) { saveUp(SPEC_COST + 80); upDone = 1; break; }
          else if (b.lvl >= 3 && !b.spec && sup >= SPEC_COST + 80) { const pl = pers.spec[t] || []; const sp = pl.length ? pl[0] : BT[t].specs[0].id; let pick = sp; if (t === 'turret') { if (s.mix[3] > s.mixT * .3) pick = 'flak'; else if (s.mix[1] + s.mix[2] > s.mixT * .4) pick = 'at'; else pick = pl.includes('twin') ? 'twin' : pick; } if (t === 'factory') { const fs = (s.blds.factory || []).map(x => x.spec); const cand = pl.find(x => !fs.includes(x)); if (cand) pick = cand; } if (t === 'barracks') { const fs = (s.blds.barracks || []).map(x => x.spec); const cand = pl.find(x => !fs.includes(x)); if (cand) pick = cand; } if (t === 'airfield') { const fs = (s.blds.airfield || []).map(x => x.spec); const cand = pl.find(x => !fs.includes(x)); if (cand) pick = cand; } if (this.cmd({ k: 'spec', b: b.id, s: pick })) { upDone = 1; break; } }
        }
      }
      // research
      if (!p.res && sup > 140 && !dif.noTech && techLeft(p) > 0) {
        const hq = playerHQLvl(p); const avail = techList(p.fac).filter(t => !p.techs[t.id] && Math.max(2, t.tier) <= hq && (t.tier === 1 || p.techs[techPrev(t, p.fac).id]));
        if (avail.length) { let pick = null; for (const id of pers.tech) { const want = TECHBY[id]; const t = avail.find(a => a.id === id || a.eq === id || (want && want.eq === a.id)); if (t) { pick = t; break; } } if (!pick && Math.random() < pers.tech * .3) pick = avail[(Math.random() * avail.length) | 0]; if (pick) { if (sup >= pick.cost + (pick.tier === 1 ? 60 : 160)) this.cmd({ k: 'tech', id: pick.id }); else saveUp(pick.cost + 60); } }
      }
    },
    frontPoint() {
      const s = this.s; let best = null, bd = 1e9; const en = W.pts.filter(q => q.owner >= 0 && P(q.owner).team !== p.team);
      for (const pt of s.ownPts) { let d = 1e9; for (const e of en) d = Math.min(d, Math.hypot(e.x - pt.x, e.z - pt.z)); if (d < bd) { bd = d; best = pt; } } return best;
    },
    placeB(type) {
      if ((BT[type].hq1 || 1) > playerHQLvl(p)) return;
      const s = this.s; const front = !!BT[type].def || type === 'wall'; const en = W.pts.filter(q => q.owner >= 0 && P(q.owner).team !== p.team); let bestS = -1e9, bp = null, bs = -1;
      for (const pt of s.ownPts) {
        let ed = 200; for (const e of en) ed = Math.min(ed, Math.hypot(e.x - pt.x, e.z - pt.z)); if (!en.length) ed = Math.hypot(pt.x, pt.z);
        for (let k = 0; k < pt.slots.length; k++) { if (pt.slots[k].b || (pt.slots[k].d && !BT[type].def) || !pt.slots[k].sea !== !BT[type].sea) continue; let sc = front ? -ed : ed * .5; if (pt.slots[k].d) sc += 30; if (pt.hq >= 0) sc += front ? -40 : 20; if (type === 'depot' && pt.hq >= 0) sc -= 30; sc += Math.random() * 10; if (sc > bestS) { bestS = sc; bp = pt; bs = k; } }
      }
      if (type === 'wall') { const fp = this.frontPoint(); if (fp && !fp.wall) this.cmd({ k: 'build', pt: fp.id, type: 'wall', slot: 0 }); return; }
      if (bp) this.cmd({ k: 'build', pt: bp.id, type, slot: bs });
    },
    // ---------------- production ----------------
    // 2.4: the AI fills its buildings' rosters a slot or two at a time (and swaps slots to counter what it sees); the buildings do the training
    unitWeight(b, t, cnt, plan) {
      const s = this.s, mix = s.mix, tot = Math.max(1, s.mixT), T = UT[t], id = T.eq || T.id;   // 3.0: a Legion troop counts as its Banner counterpart
      let w = pers.uw[t]; if (w === undefined && T.eq) w = pers.uw[T.eq]; if (w === undefined && LEG_OF[t]) w = pers.uw[LEG_OF[t]];
      const ck = k => (cnt[k] || 0) + (LEG_OF[k] ? cnt[LEG_OF[k]] || 0 : 0);
      if (w === undefined) w = T.air ? .08 : b.type === 'hq' ? .35 : .2;
      if (T.naval) w = id === 'lcraft' ? (this.isles().length ? (ck('lcraft') < 1 ? 2.4 : ck('lcraft') < 2 ? .35 : .02) : ck('lcraft') < 1 ? .3 : .02) : id === 'destroyer' ? 1.6 : 1.3;   // 3.0: a fleet, and boats for islands
      if (w <= 0) return 0;
      if (T.w && dif.counter > 0 && tot > 80) { let eff = 0; const ws = T.w2 ? [T.w, T.w2] : [T.w]; for (let c = 0; c < 4; c++) { let m = 0; for (const wp of ws) { let mm = WTM[wp.wt][c]; if (c === 3 && wp.g === 'g') mm = 0; if (c !== 3 && wp.g === 'a') mm = 0; m = Math.max(m, mm); } eff += mix[c] / tot * m; } w *= clamp(1 + dif.counter * (eff - .75), .2, 3); }
      if (id === 'aa' || id === 'interceptor') { w *= 1 + (mix[3] / tot) * 8 * dif.counter; if (mix[3] < 60) w *= .12; }
      if (id === 'scout') w *= ck('scout') < 2 ? 1.5 : .05;
      if (id === 'medic') w *= ck('medic') < plan.inf / 7 ? 2 : .1;
      if (id === 'engineer') w *= ck('engineer') < Math.min(4, 1 + s.ownPts.length) ? 3 : .03;
      if (id === 'jeep') w *= ck('jeep') < 3 ? 1.2 : .25;
      if (id === 'artillery' || id === 'mlrs') w *= (ck('artillery') + ck('mlrs')) < Math.max(1, plan.all * .2) ? 1 : .1;
      if (T.air && !DRONES[t] && plan.air + 1 > Math.max(1, plan.all * (pers.id === 'voss' ? .35 : .12))) w *= .03;   // never an air-only army
      w /= Math.pow(1 + (cnt[t] || 0) / 5, .7);
      return w;
    },
    produce() {
      const s = this.s, nCombat = s.combat.length, emerg = this.t - (this.lastEmerg || -99) < 8;
      // money held back for buildings and upgrades: the rosters only train with what is left over
      p.resv = emerg ? 0 : (nCombat >= 5 && dif.counter > 0 ? (this.saveFor || 0) : 0) * (this.state === 'attack' ? .6 : .9) + (dif.bank || 0);
      p.popLim = dif.popLim;
      const cnt = {}, plan = { all: 0, inf: 0, air: 0 }, list = [];
      for (const b of W.bld) { if (b.owner !== p.id || !b.ros) continue; for (const k in b.ros) { const n = b.ros[k]; cnt[k] = (cnt[k] || 0) + n; plan.all += n; if (UT[k].cls === 0) plan.inf += n; if (UT[k].air && !DRONES[k]) plan.air += n; } if (b.prog >= 1 && !b.dead) list.push(b); }
      list.sort((x, y) => rosTotal(x) / Math.max(1, rosCap(x)) - rosTotal(y) / Math.max(1, rosCap(y)));
      // 3.0: a Shipyard gets its first few ships before anything else (otherwise cheap troops elsewhere always use the money up first)
      const yd = list.find(b => b.type === 'shipyard' && rosTotal(b) < Math.min(dif.noTech ? 1 : dif.counter >= .8 ? 3 : 2, rosCap(b))); if (yd) { list.splice(list.indexOf(yd), 1); list.unshift(yd); }
      const add = (b, t) => { if (slotCost(p, t, b) > p.sup - (p.resv || 0)) { this.saveFor = this.saveFor || slotCost(p, t, b); return false; } if (!this.cmd({ k: 'ros', b: b.id, u: t, d: 1 })) return false; cnt[t] = (cnt[t] || 0) + 1; plan.all++; if (UT[t].cls === 0) plan.inf++; if (UT[t].air && !DRONES[t]) plan.air++; return true; };
      let changes = 0; const maxCh = dif.burst || 1;
      for (const b of list) {
        if (!b.hasRally && this.stage) this.cmd({ k: 'rally', b: b.id, x: this.stage[0], z: this.stage[1] });
        if (changes >= maxCh) continue;
        const ul = unitsForB(b); if (!ul.length) continue;
        const sc = []; let sum = 0; for (const t of ul) { if (!rosFits(b, t)) continue; const w = this.unitWeight(b, t, cnt, plan); if (w > 0) { sc.push([t, w]); sum += w; } }
        if (rosTotal(b) < rosCap(b)) {
          if (!sc.length) continue; let r = Math.random() * sum, pick = sc[0][0]; for (const [t, w] of sc) { r -= w; if (r <= 0) { pick = t; break; } }
          if (dif.counter >= 1 && Math.random() < .5) { let bst = sc[0]; for (const x of sc) if (x[1] > bst[1]) bst = x; pick = bst[0]; }
          if (add(b, pick)) changes++; else if (b === yd) break;   // save up for the ship
        } else if (dif.counter > 0 && Math.random() < .3 * dif.counter) {
          // roster full: swap the least useful slot for something that counters the enemy better
          let worst = null, ww = 1e9; for (const k in b.ros) { const c2 = Object.assign({}, cnt); c2[k]--; const w = this.unitWeight(b, k, c2, plan); if (w < ww) { ww = w; worst = k; } }   // judged as if one fewer, so it is not swapped out and straight back in
          let best = null, bw = 0; for (const t of ul) { if (t === worst) continue; const w = this.unitWeight(b, t, cnt, plan); if (w > bw) { bw = w; best = t; } }
          if (worst && best && bw > ww * 2.5 + .05 && this.cmd({ k: 'ros', b: b.id, u: worst, d: -1 })) { cnt[worst]--; plan.all--; if (UT[worst].cls === 0) plan.inf--; if (UT[worst].air && !DRONES[worst]) plan.air--; if (rosFits(b, best)) add(b, best); changes++; }
        }
      }
    },
    // ---------------- military ----------------
    powerNear(x, z, r) { let pw = 0; for (const e of this.s.enemy) if (Math.hypot(e.x - x, e.z - z) < r) pw += e.T.cost * (e.hp / e.maxHp); for (const b of this.s.enemyBlds) if (b.w && Math.hypot(b.x - x, b.z - z) < r + 10) pw += 160 * b.lvl; return pw; },
    military() {
      const s = this.s; const myT = p.team; const hq = p.hqB; if (!hq) return;
      const enemies = W.pts.filter(q => q.owner >= 0 && P(q.owner).team !== myT);
      // staging point: own point nearest the enemy
      let stagePt = null, bd = 1e9; const eHQ = W.players.filter(q => q.alive && q.team !== myT && q.hqB).map(q => q.hqB);
      for (const pt of s.ownPts) { if (!this.reach(pt)) continue; let d = 1e9; for (const e of eHQ) d = Math.min(d, Math.hypot(e.x - pt.x, e.z - pt.z)); if (d < bd) { bd = d; stagePt = pt; } }
      if (!stagePt) stagePt = W.pts[W.M.spawnPts[p.spawn]];
      const toward = eHQ.length ? eHQ[0] : { x: 0, z: 0 }; const dx = toward.x - stagePt.x, dz = toward.z - stagePt.z, dl = Math.hypot(dx, dz) || 1;
      this.stage = [stagePt.x + dx / dl * 18, stagePt.z + dz / dl * 18]; this.stagePt = stagePt;
      // clean roles
      for (const [id, r] of this.role) { const u = W.byId.get(id); if (!u || u.dead) this.role.delete(id); }
      // ---- defense ----
      const threatened = []; const seenNow = new Set(); this.urgent = false;
      for (const pt of s.ownPts) {
        if (!this.reach(pt)) continue; const tp = this.powerNear(pt.x, pt.z, 36); if (tp <= 60) continue; seenNow.add(pt.id);
        let th = this.threatSince.get(pt.id); if (!th) { th = { t: this.t, ign: pt.hq < 0 && Math.random() < dif.leave }; this.threatSince.set(pt.id, th); }   // slow to notice, and sometimes shrugs off a flag
        if (this.t - th.t >= dif.react && !th.ign) { threatened.push([pt, tp]); this.urgent = true; }
      }
      for (const id of [...this.threatSince.keys()]) if (!seenNow.has(id)) this.threatSince.delete(id);
      for (const b of W.bld) { if (b.owner !== p.id || b.type === 'nest') continue; }
      const defenders = new Set();
      for (const [pt, tp] of threatened) {
        this.lastThreat = this.t; const near = s.combat.filter(u => Math.hypot(u.x - pt.x, u.z - pt.z) < 90 && this.role.get(u.id) !== 'cap' && this.role.get(u.id) !== 'crate' && this.role.get(u.id) !== 'isle');
        let mine = near.reduce((a, u) => a + u.T.cost * (u.hp / u.maxHp), 0);
        const pull = (pt.hq >= 0 || tp > mine * 1.0) ? s.combat.filter(u => this.role.get(u.id) !== 'cap' && this.role.get(u.id) !== 'isle' && (pt.hq >= 0 || this.role.get(u.id) !== 'crate')) : near;
        if (tp > mine * 1.05 && tp > 150) this.lastEmerg = this.t;
        for (const u of pull) { if (defenders.has(u.id)) continue; defenders.add(u.id); this.role.set(u.id, 'def'); }
        const grp = pull.filter(u => Math.hypot(u.x - pt.x, u.z - pt.z) > 18); this.ord(grp, 'am', pt.x + rr(-4, 4), pt.z + rr(-4, 4));
        if (dif.call > 0 && tp > mine * 1.2 && tp > 250 && (p.cd.merc || 0) <= 0 && callAvail(p, 'merc') && p.sup > 400) this.cmd({ k: 'call', id: 'merc', x: pt.x, z: pt.z });
        for (const e of s.med) this.ord([e], 'mv', pt.x, pt.z);
      }
      for (const [id, r] of this.role) if (r === 'def' && !defenders.has(id)) this.role.delete(id);
      // ---- capture squads ----
      const capTargets = s.oppPts.filter(q => !(q.hq >= 0) && this.reach(q)).sort((a, b) => Math.hypot(a.x - hq.x, a.z - hq.z) - Math.hypot(b.x - hq.x, b.z - hq.z));
      let sq = 0; for (const [ptId, ids] of this.caps) { const pt = W.pts[ptId]; const alive = ids.filter(id => { const u = W.byId.get(id); return u && !u.dead; }); if (!alive.length || (pt.owner >= 0 && P(pt.owner).team === myT)) { for (const id of ids) if (this.role.get(id) === 'cap') this.role.delete(id); this.caps.delete(ptId); } else { this.caps.set(ptId, alive); sq++; } }
      const maxSq = dif.capCd ? 1 : 1 + Math.round(pers.expand * (dif.counter > 0 ? 2 : 1));
      const mayExpand = this.focus === 'expand' || this.t < 90;
      for (const pt of capTargets) {
        if (sq >= maxSq || !mayExpand) break; if (this.caps.has(pt.id)) continue; if (pt.owner >= 0) continue; if (dif.capCd && this.t - (this.lastCap || -99) < dif.capCd) break;
        if (this.powerNear(pt.x, pt.z, 30) > 120) continue;
        const pool = s.combat.filter(u => !this.role.has(u.id) && u.T.cap).sort((a, b) => (Math.hypot(a.x - pt.x, a.z - pt.z) - (a.T.spd * 4)) - (Math.hypot(b.x - pt.x, b.z - pt.z) - (b.T.spd * 4)));
        const sz = this.t < 90 ? 2 : 3; const pick = pool.slice(0, sz); if (pick.length < 1) continue; if (Math.hypot(pick[0].x - pt.x, pick[0].z - pt.z) > 160 && pick.length < 2) continue;
        this.caps.set(pt.id, pick.map(u => u.id)); this.lastCap = this.t; for (const u of pick) this.role.set(u.id, 'cap'); this.ord(pick, 'am', pt.x, pt.z); sq++;
      }
      for (const [ptId, ids] of this.caps) { const pt = W.pts[ptId]; const us = ids.map(id => W.byId.get(id)).filter(Boolean); const far = us.filter(u => u.o === 0 && Math.hypot(u.x - pt.x, u.z - pt.z) > 6); if (far.length) this.ord(far, 'am', pt.x, pt.z); }
      // ---- strike force ----
      const atk = s.combat.filter(u => !this.role.has(u.id) || this.role.get(u.id) === 'atk');
      for (const u of atk) this.role.set(u.id, 'atk');
      const power = atk.reduce((a, u) => a + u.T.cost * (u.hp / u.maxHp), 0);
      let cx = 0, cz = 0; for (const u of atk) { cx += u.x; cz += u.z; } if (atk.length) { cx /= atk.length; cz /= atk.length; }
      const needP = (260 + 150 * this.wave) * (pers.army / 8) / Math.max(.5, pers.aggr) * (1 + .1 * Math.min(6, enemies.length)) * dif.atkMul;
      const toStage = () => { const idle = atk.filter(u => Math.hypot(u.x - this.stage[0], u.z - this.stage[1]) > 22 && u.o === 0); this.ord(idle, 'mv', this.stage[0] + rr(-6, 6), this.stage[1] + rr(-6, 6)); for (const m of s.med) if (Math.hypot(m.x - this.stage[0], m.z - this.stage[1]) > 25 && m.o === 0) this.ord([m], 'mv', this.stage[0], this.stage[1]); };
      if (this.state === 'mass') {
        toStage();
        const ready = this.t >= this.nextAtk && atk.length >= 4 && this.t - this.lastRetreat > 12 && !this.urgent;
        const strong = power >= needP, late = this.t >= this.nextAtk + 70 && power > needP * .6, full = p.pop >= Math.min(p.popCap, dif.popLim) - 1 && power > needP * .5;
        if (ready && (strong || late || full)) {
          const tgt = this.pickTarget(atk, cx, cz, power);
          if (tgt) { this.state = 'gather'; this.tgtPt = tgt.id; this.startPower = power; this.gatherT = this.t + dif.warn * (.8 + Math.random() * .5); this.warnHumans('massing', this.stagePt); this.say('attack'); }
        }
      } else if (this.state === 'gather') {
        toStage();      // build-up: the army waits at the staging flag so the enemy can see it coming
        if (this.t >= this.gatherT) { this.state = 'attack'; this.atkStart = this.t; this.startPower = Math.max(power, 1); const tp = W.pts[this.tgtPt]; if (tp) this.warnHumans('incoming', tp); }
      } else if (this.state === 'attack') {
        const pt = W.pts[this.tgtPt];
        if (!pt || (pt.owner >= 0 && P(pt.owner).team === myT) || atk.length < 2) {
          // pick next or go home
          const tgt = atk.length >= 4 && power > this.startPower * .6 && this.t - this.atkStart < 150 ? this.pickTarget(atk, cx, cz, power) : null;
          if (tgt) { this.tgtPt = tgt.id; this.startPower = Math.max(power, this.startPower * .8); } else { this.endWave(false); }
        } else {
          const local = this.powerNear(cx, cz, 45);
          const ratio = power / Math.max(30, local + 1);
          const hqTarget = pt.hq >= 0;
          if (dif.retreat > 0 && ((ratio < dif.retreat && power < this.startPower * .85 && !hqTarget) || (power < this.startPower * .45 && !hqTarget) || (power < this.startPower * .22 && atk.length < 5))) {
            this.endWave(true); this.say('retreat'); this.ord(atk, 'mv', this.stage[0], this.stage[1]); for (const m of s.med) this.ord([m], 'mv', this.stage[0], this.stage[1]);
          } else {
            const far = atk.filter(u => !u.T.air && ((u.o === 0) || (u.o === 2 && Math.hypot(u.tx - pt.x, u.tz - pt.z) > 10)));
            this.ord(far, 'am', pt.x + rr(-6, 6), pt.z + rr(-6, 6));
            const airs = atk.filter(u => u.T.air && (u.o === 0 || Math.hypot(u.tx - pt.x, u.tz - pt.z) > 30));
            if (airs.length) { const lead = Math.min(1, 40 / Math.max(1, Math.hypot(pt.x - cx, pt.z - cz))); this.ord(airs, 'am', cx + (pt.x - cx) * lead, cz + (pt.z - cz) * lead); }
            let mx = cx, mz = cz; if (navBlockedAt(W.M, cx, cz)) { let bd = 1e9; for (const u of atk) if (!u.T.air) { const d = (u.x - cx) * (u.x - cx) + (u.z - cz) * (u.z - cz); if (d < bd) { bd = d; mx = u.x; mz = u.z; } } }   // 3.0: the middle of an army split around a bay or a lake is under water: medics follow the nearest soldier instead
            for (const m of s.med) { if (m.o === 0 || Math.random() < .3) this.ord([m], 'mv', mx, mz); }
          }
        }
      }
      // engineers: stay home, field nest on contested front for hard AIs
      if (dif.counter >= 1 && p.sup > 350 && this.t - this.nestT > 40 && s.eng.length) {
        const fp = this.frontPoint(); if (fp) { const e = s.eng[0]; const a = Math.random() * TAU; this.nestT = this.t; this.cmd({ k: 'nest', ids: [e.id], x: fp.x + Math.cos(a) * 9, z: fp.z + Math.sin(a) * 9 }); }
      }
      for (const e of s.eng) if (e.o === 0 && Math.random() < .2) { const pts = s.ownPts.filter(q => this.reach(q)); const pt = pts[(Math.random() * pts.length) | 0]; if (pt && Math.hypot(e.x - pt.x, e.z - pt.z) > 30) this.ord([e], 'mv', pt.x, pt.z); }
    },
    // 3.0: race for supply crates, and get out from under artillery strikes
    events() {
      const s = this.s; if (!W.fev) return; const supplyGame = W.o.obj && W.o.obj.type === 'supply'; const hq = p.hqB;
      const sq = this.crateSq || (this.crateSq = new Map());
      for (const e of W.fev) {
        if (e.k === 'strike') {
          if (e.dodge || Math.random() > .3 + dif.counter * .6) continue; e.dodge = e.dodge || {}; if (e.dodge[p.id]) continue; e.dodge[p.id] = 1;
          const mine = s.my.filter(u => !u.T.air && Math.hypot(u.x - e.x, u.z - e.z) < e.r + 4); if (!mine.length || !hq) continue;
          const a = Math.atan2(hq.z - e.z, hq.x - e.x); this.ord(mine, 'mv', e.x + Math.cos(a) * (e.r + 12), e.z + Math.sin(a) * (e.r + 12));
        } else if (e.k === 'crate') {
          let ids = sq.get(e.id);
          if (!ids) {
            if (e.skip && e.skip[p.id]) continue; if (!supplyGame && Math.random() > .45 + dif.counter * .5) { (e.skip = e.skip || {})[p.id] = 1; continue; }
            const pool = s.combat.filter(u => !u.T.air && u.T.cap && this.role.get(u.id) !== 'def' && this.role.get(u.id) !== 'cap').sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z));
            const pick = pool.slice(0, supplyGame ? 7 : 3); if (!pick.length) continue; ids = pick.map(u => u.id); sq.set(e.id, ids); for (const u of pick) this.role.set(u.id, 'crate'); this.ord(pick, 'am', e.x, e.z);
          } else {
            // keep the squad on the crate: fight on the way in, then stand on it (and top the squad up if it is shot to pieces)
            const us = ids.map(id => W.byId.get(id)).filter(u => u && !u.dead && this.role.get(u.id) === 'crate'); const dd = u => Math.hypot(u.x - e.x, u.z - e.z);
            if (us.length < (supplyGame ? 4 : 2)) { const more = s.combat.filter(u => !u.T.air && u.T.cap && !this.role.has(u.id)).sort((a, b) => dd(a) - dd(b)).slice(0, (supplyGame ? 6 : 3) - us.length); for (const u of more) { this.role.set(u.id, 'crate'); ids.push(u.id); us.push(u); } }
            const farA = us.filter(u => dd(u) > 28 && u.o === 0), farM = us.filter(u => dd(u) > 4.5 && dd(u) <= 28 && !(u.o === 1 && Math.hypot(u.tx - e.x, u.tz - e.z) < 3));
            if (farA.length) this.ord(farA, 'am', e.x, e.z); if (farM.length) this.ord(farM, 'mv', e.x + rr(-1.5, 1.5), e.z + rr(-1.5, 1.5));
          }
        }
      }
      for (const [id, ids] of sq) if (!W.fev.some(e => e.id === id)) { for (const uid of ids) if (this.role.get(uid) === 'crate') this.role.delete(uid); sq.delete(id); }
    },
    // ---------------- 3.0 navy: warships hunt enemy ships and shell the coast; Landing Craft ferry soldiers to islands ----------------
    isles() {   // flags that cannot be reached on foot from this commander's base but can be reached by sea
      if (this._isleT === W.tick >> 6 && this._isles) return this._isles; this._isleT = W.tick >> 6; const hq = p.hqB, M = W.M;
      this._isles = !M.naval || !hq ? [] : W.pts.filter(pt => pt.coast && pt.comp !== W.pts[hq.pt].comp); return this._isles;
    },
    fleet() {
      const s = this.s, M = W.M; if (!M.naval) return; const myT = p.team;
      if (p.hqB) { const hc = W.pts[p.hqB.pt].comp; for (const u of s.combat) if (!u.T.air && this.role.get(u.id) !== 'boat' && !u.fromBoat && M.compAt(u.x, u.z) !== hc) this.role.set(u.id, 'isle'); }   // troops on an island stay there and guard it
      if (!s.navy.length && !s.boats.length) return;
      const home = s.ownPts.filter(pt => pt.coast).sort((a, b) => (b.slots.some(x => x.sea && x.b && x.b.owner === p.id) ? 1 : 0) - (a.slots.some(x => x.sea && x.b && x.b.owner === p.id) ? 1 : 0))[0];
      if (s.navy.length) {
        let cx = 0, cz = 0; for (const u of s.navy) { cx += u.x; cz += u.z; } cx /= s.navy.length; cz /= s.navy.length;
        let tgt = null, bd = 1e9; for (const e of s.enemy) if (e.T.naval) { const d = Math.hypot(e.x - cx, e.z - cz); if (d < bd) { bd = d; tgt = [e.x, e.z]; } }
        if (!tgt && (s.navy.length >= 2 || this.state === 'attack' || dif.counter <= 0)) {   // shell the enemy coast: their flags by the water, the weakest first
          let bs = -1e9; for (const pt of W.pts) { if (!pt.coast || pt.owner < 0 || P(pt.owner).team === myT) continue; const sc = -Math.hypot(pt.coast[0] - cx, pt.coast[1] - cz) * .5 - this.powerNear(pt.x, pt.z, 40) * .3 + (pt.hq >= 0 ? 30 : 0); if (sc > bs) { bs = sc; tgt = pt.coast; } }
        }
        if (!tgt && this.boatTgt) tgt = this.boatTgt.coast;   // cover the landing
        if (!tgt && home) tgt = home.coast;
        if (tgt) { const far = s.navy.filter(u => u.o === 0 ? Math.hypot(u.x - tgt[0], u.z - tgt[1]) > 16 : Math.hypot(u.tx - tgt[0], u.tz - tgt[1]) > 24); if (far.length) this.ord(far, 'am', tgt[0] + rr(-5, 5), tgt[1] + rr(-5, 5)); }
      }
      // Landing Craft: load soldiers at home, sail them to an island (or a weakly held flag by the water), land them, come back
      const bm = this.boat || (this.boat = new Map()); this.boatTgt = null;
      for (const b of s.boats) {
        let st = bm.get(b.id); if (!st) { st = { s: 'load', t: this.t, ids: [] }; bm.set(b.id, st); } const cp = cargoPop(b);
        if (st.s === 'load') {
          const isles = this.isles().filter(pt => pt.owner < 0 || P(pt.owner).team !== myT);
          if ((cp >= 6 || (cp > 0 && this.t - st.t > 45)) && isles.length) {
            const pt = isles.sort((a, c) => this.powerNear(a.x, a.z, 30) - this.powerNear(c.x, c.z, 30))[0];
            if (this.cmd({ k: 'unload', ids: [b.id], x: pt.x, z: pt.z })) { st.s = 'go'; st.t = this.t; st.pt = pt.id; for (const id of st.ids) { const u = W.byId.get(id); if (u && !u.dead) this.role.delete(id); } st.ids = []; }
          } else if (isles.length && cp < 6 && this.t - (st.lt || -99) > 14) {
            const pool = s.combat.filter(u => u.T.cls === 0 && !u.T.air && u.o !== 7 && (!this.role.has(u.id) || (this.role.get(u.id) === 'atk' && this.state === 'mass')) && Math.hypot(u.x - b.x, u.z - b.z) < 80).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z));
            const pick = []; let room = b.T.carry - cp; for (const u of pool) { if (u.T.pop > room) continue; pick.push(u); room -= u.T.pop; if (room <= 1 || pick.length >= 6) break; }
            if (pick.length && this.cmd({ k: 'board', ids: pick.map(u => u.id), t: b.id })) { st.lt = this.t; for (const u of pick) { this.role.set(u.id, 'boat'); st.ids.push(u.id); } }
          }
        } else if (st.s === 'go') {
          const pt = W.pts[st.pt]; this.boatTgt = pt;
          if (!cp) {   // landed: the soldiers take the flag
            const landed = s.my.filter(u => u.fromBoat === b.id); for (const u of landed) { u.fromBoat = 0; this.role.set(u.id, 'cap'); }
            if (landed.length && pt) { this.caps.set(pt.id, landed.map(u => u.id)); this.ord(landed, 'am', pt.x, pt.z); }
            st.s = 'back'; st.t = this.t; if (home && home.coast) this.cmd({ k: 'mv', ids: [b.id], x: home.coast[0], z: home.coast[1] });
          } else if (b.o === 0 && this.t - st.t > 20) { st.t = this.t; if (pt) this.cmd({ k: 'unload', ids: [b.id], x: pt.x, z: pt.z }); }
        } else if (this.t - st.t > 25 || (b.o === 0 && this.t - st.t > 6)) { st.s = 'load'; st.t = this.t; }
      }
      for (const [id] of bm) { const u = W.byId.get(id); if (!u || u.dead) bm.delete(id); }
    },
    endWave(retreat) { this.state = 'mass'; this.wave++; if (retreat) this.lastRetreat = this.t; this.nextAtk = this.t + dif.pause * (retreat ? 1.3 : 1) * (.8 + Math.random() * .5); },
    warnHumans(code, pt) { if (!pt || W.o.demo || this.t < 30) return; for (const q of W.players) if (q.team !== p.team && (q.kind === 'human' || q.kind === 'remote')) alertMsg(q.id, code, pt.x, pt.z, 0, pt.hq >= 0 ? 'their base' : pt.name); },
    pickTarget(atk, cx, cz, power) {
      const s = this.s; const cands = W.pts.filter(q => (q.owner >= 0 && P(q.owner).team !== p.team || q.owner < 0) && this.reach(q));
      let best = null, bs = -1e9;
      const total = W.pts.filter(q => q.owner >= 0 && P(q.owner).team !== p.team).length;
      for (const pt of cands) {
        const isHQ = pt.hq >= 0; const d = Math.hypot(pt.x - cx, pt.z - cz); const def = this.powerNear(pt.x, pt.z, 40);
        if (def > power * 1.1 && !isHQ) continue; if (isHQ && (def > power * 1.3 || power < dif.hqPower)) continue;
        let sc = pt.val * 40 - d * .35 - def * .4 + (pt.owner >= 0 ? 35 : 15); if (isHQ) sc += power > dif.hqPower ? 70 + (total <= 2 ? 80 : 0) : -60;
        if (W.o.obj && W.o.obj.type === 'koth' && W.o.obj.pt === pt.id) sc += 160;
        if (pt.owner >= 0) { const o = P(pt.owner); const weak = o.pop < 18 ? 20 : 0; sc += weak; }
        sc += Math.random() * 15 * (1 - dif.counter * .3) + Math.random() * dif.mistakes * 90; if (sc > bs) { bs = sc; best = pt; }
      }
      return best;
    },
    // ---------------- call-ins ----------------
    calls() {
      if (!dif.call || this.t < 100) return; const s = this.s;
      for (const id of pers.calls) {
        if (!callAvail(p, id) || (p.cd[id] || 0) > 0) continue; const cost = callCost(p, id); if (p.sup < cost + 120 || Math.random() > .5 * dif.call + .2) continue;
        if (id === 'air' || id === 'barrage' || id === 'cruise') {
          const R = id === 'cruise' ? 22 : id === 'barrage' ? 20 : 14, thr = id === 'cruise' ? 900 : id === 'barrage' ? 380 : 260; let best = null, bv = 0;
          const pool = s.enemy; for (const c of pool) {
            let v = 0, f = 0; for (const e of pool) if (Math.hypot(e.x - c.x, e.z - c.z) < R) v += e.T.cost; for (const b of s.enemyBlds) if (Math.hypot(b.x - c.x, b.z - c.z) < R) v += 120 * b.lvl;
            for (const u of s.my) if (Math.hypot(u.x - c.x, u.z - c.z) < R) f += u.T.cost; v -= f * 1.2; if (v > bv) { bv = v; best = c; }
          }
          if (id !== 'air') for (const b of s.enemyBlds) { if (b.type === 'hq' || b.type === 'arty' || b.type === 'turret') { let f = 0; for (const u of s.my) if (Math.hypot(u.x - b.x, u.z - b.z) < R) f += u.T.cost; const v = 260 * b.lvl + (b.type === 'hq' ? 400 : 0) - f; if (v > bv && (id !== 'cruise' || b.type === 'hq')) { bv = v; best = b; } } }
          if (best && bv >= thr) { this.cmd({ k: 'call', id, x: best.x, z: best.z }); break; }
        } else if (id === 'supply') {
          const atk = s.combat.filter(u => this.role.get(u.id) === 'atk' && u.hp < u.maxHp * .6); if (atk.length >= 5) { let cx = 0, cz = 0; for (const u of atk) { cx += u.x; cz += u.z; } this.cmd({ k: 'call', id, x: cx / atk.length, z: cz / atk.length }); break; }
        } else if (id === 'para') {
          const targets = s.oppPts.filter(q => q.hq < 0 && q.owner < 0 && seen(p.team, q.x, q.z) && this.powerNear(q.x, q.z, 30) < 80); if (targets.length && Math.random() < .5) { const q = targets[(Math.random() * targets.length) | 0]; this.cmd({ k: 'call', id, x: q.x, z: q.z }); break; }
        } else if (id === 'armor' || id === 'merc') {
          if (this.state === 'attack' && p.sup > cost + 300) { const atk = s.combat.filter(u => this.role.get(u.id) === 'atk'); if (atk.length > 5) { let cx = 0, cz = 0; for (const u of atk) { cx += u.x; cz += u.z; } cx /= atk.length; cz /= atk.length; const q = snapFree(W.M, cx, cz, 6); if (W.o.fog && !seen(p.team, q[0], q[1])) continue; this.cmd({ k: 'call', id, x: q[0], z: q[1] }); break; } }
        } else if (id === 'recon') {
          const en = W.pts.filter(q => q.owner >= 0 && P(q.owner).team !== p.team && !explored(p.team, q.x, q.z)); if (W.o.fog && en.length && p.sup > 400) { const q = en[(Math.random() * en.length) | 0]; this.cmd({ k: 'call', id, x: q.x, z: q.z }); break; }
        }
      }
    }
  };
  return ai;
}
