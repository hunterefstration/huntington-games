
'use strict';
// =====================================================================
//  TROOPS, MERCENARIES, WALLS AND TRAPS  (behaviour)
//  Data lives in data.js (TROOP_TYPES, MERCS, TOWERS). Every troop is one
//  Troop object whose "role" picks its AI: melee, ranged, aoe, artillery,
//  medic, engineer, sentry or tank. Barracks and contractors share it.
// =====================================================================
const RANGED_ROLES = new Set(['ranged', 'aoe', 'artillery', 'medic', 'sentry', 'engineer']);
const NON_SHOOTERS = new Set(['income', 'aura', 'heal', 'barracks', 'hq', 'mine', 'trap', 'tank']);
function isShooter(def) { return def.kind === 'fence' ? !!def.shoots : !NON_SHOOTERS.has(def.kind); }
const isStructure = (def) => def.kind === 'fence' || def.kind === 'trap';

class Troop {
  constructor(kind, x, y, o = {}) {
    const T = TROOP_TYPES[kind] || TROOP_TYPES.soldier;
    Object.assign(this, { hp: 120, dmg: 8, rate: 45, range: 22, speed: 1.6, r: 7, armor: 0, leash: 70, color: '#c0392b', guard: 1, bd: 1, bs: 1, bg: 1, bregen: 0, stunT: 0 }, T, o);
    this.kind = kind; this.x = x; this.y = y; this.home = { x, y }; this.order = null;
    this.maxHp = this.hp; this.cd = 0; this.target = null; this.angle = 0; this.flash = 0; this.id = Troop.next++;
    this.owner = o.owner || null; this.life0 = this.life || 0;
    this.ranged = RANGED_ROLES.has(this.role); this.hitsAir = !!this.hitsAir;
  }
}
Troop.next = 1;

// ---------------------------------------------------------------------
//  Tanks
// ---------------------------------------------------------------------
function makeTank() {
  const pi = (Math.random() * G.paths.length) | 0, p = G.paths[pi];
  return new Troop('tank', G.base.x, G.base.y, { hp: 1000 * (1 + G.wave * (G.gm === 'troop' ? TM.tank : 0.06)), dmg: 40 * (1 + G.wave * (G.gm === 'troop' ? TM.tank * 1.4 : 0.1)), rate: 30, range: 130, speed: 1, r: 15, path: pi, d: p.len - 10, color: '#2980b9', role: 'tank' });
}
function deployTank(free) { if (G.gm === 'tower') return; G.troops.push(makeTank()); if (free) toast('Armory Line rolled out a free Tank', '#8cc8ff'); }

// ---------------------------------------------------------------------
//  Barracks: keep the squad topped up
// ---------------------------------------------------------------------
function spawnTroopFor(g, st) {
  const def = g.def, T = TROOP_TYPES[def.troop] || TROOP_TYPES.soldier, m = st.mods, tx = m.tx || {}, o = Object.assign({}, m.ts || {});
  for (const k in tx) { if (k === 'hp' || k === 'dmg') continue; const base = o[k] != null ? o[k] : T[k]; if (base != null) o[k] = base * tx[k]; }
  const tm = G.gm === 'troop';
  o.hp = Math.round(st.troopHp * (1 + G.wave * (tm ? TM.hp : 0.03)));
  o.dmg = Math.max(1, st.troopDmg * (1 + G.wave * (tm ? TM.dmg : 0.05)));
  o.owner = g;
  const off = formationOffset(g.squad.length, st.soldiers);
  const t = new Troop(def.troop, g.x, g.y, o);
  t.home = { x: g.rally.x + off.x, y: g.rally.y + off.y };
  g.squad.push(t); G.troops.push(t);
  let n = 0; for (const x of G.troops) if (x.owner && x.hp > 0) n++;
  if (n >= 12) unlock('army');
  if (BARRACKS_IDS.every(id => G.towers.some(b => b.def.id === id))) unlock('garrison');
}
const BARRACKS_IDS = TOWERS.filter(t => t.kind === 'barracks' && t.era !== 'alien').map(t => t.id);     // the 'Combined Arms' achievement counts the eight human barracks
function updateBarracks(g) {
  const u = g.units[0], st = u.stats;
  if (!g.squad) g.squad = [];
  if (g.squad.some(t => t.hp <= 0)) g.squad = g.squad.filter(t => t.hp > 0);
  if (!g.rally) { const np = nearestPathPoint(G, g.x, g.y); g.rally = np && np.d < st.range ? { x: np.x, y: np.y } : { x: g.x, y: g.y + 30 }; }
  if (g.squad.length < st.soldiers) {
    // a fresh barracks (or one that just changed specialty) fills its squad fast; after that, dead troops take the full respawn time
    g.respawnT = (g.respawnT || 0) + g.buff.resp;
    if (g.respawnT >= (!g.everSpawned ? 25 : st.respawn)) { g.respawnT = 0; spawnTroopFor(g, st); }
  } else { g.respawnT = 0; g.everSpawned = true; }
}
// groups of troops that are selected together (a barracks squad, a mercenary squad, a reinforcement team)
function groupOf(t) {
  if (t.fixed) return [];
  if (t.owner && t.owner.squad) return t.owner.squad.filter(s => s.hp > 0);
  if (t.squadList) return t.squadList.filter(s => s.hp > 0);
  return [t];
}

// ---------------------------------------------------------------------
//  Troop AI
// ---------------------------------------------------------------------
function troopOpts(t) {
  if (t.hero) return { src: t, group: null, pierceArmor: !!t.pierceArmor, crit: t.crit, critMult: t.critMult, heavyBonus: t.heavyBonus, shieldMul: t.shieldMul, dodgeable: false };
  const g = t.owner;
  return { src: g && g.units ? g.units[0] : null, group: g, pierceArmor: !!t.pierceArmor, crit: t.crit, critMult: t.critMult, heavyBonus: t.heavyBonus, shieldMul: t.shieldMul, dodgeable: false };
}
function troopDamage(t) {
  let d = t.dmg * t.bd;
  if (t.vetN) d *= 1 + 0.06 * t.vetN;
  if (t.frenzy && t.hp < t.maxHp * 0.5) d *= 1.5;
  return d;
}
function troopLine(x1, y1, x2, y2, color) { if (G.lines.length < 160) G.lines.push({ x1, y1, x2, y2, life: 4, ml: 4, color: color || '#f9e79f', w: 1 }); }
function medPulse(t) {
  for (const o of G.troops) if (o.hp > 0 && o.hp < o.maxHp && dist(o.x, o.y, t.x, t.y) <= t.medRad) { o.hp = Math.min(o.maxHp, o.hp + t.medAura / 3); if (Math.random() < 0.3) burst(o.x, o.y - 4, '#fff59d', 1, 0.6, 2, 14); }
}
// on-hit extras shared by every troop
function afterHit(t, e, dmg) {
  const src = t.owner && t.owner.units ? t.owner.units[0] : null, grp = t.owner;
  if (e.alive) {
    if (t.burn) e.burn = { dps: dmg * t.burn / 120, t: 120, src, group: grp };
    if (t.bleed) e.poison = { dps: dmg * t.bleed / 120, t: 120, src, group: grp };
    if (t.mark) { e.markT = 180; e.mark = Math.max(e.mark, t.mark); }
    if (t.slow && !e.def.noSlow) { e.slowT = Math.max(e.slowT, t.slowTicks || 90); e.slowP = Math.max(e.slowP, t.slow); }
    if (t.stun && !e.def.boss && Math.random() < t.stun) { e.stunT = Math.max(e.stunT, t.stunTicks || 30); floatText(e.x, e.y - e.r - 8, 'stun', '#fff59d'); }
    if (t.acid) e.armor = Math.max(0, e.armor - t.acid);
  }
  if (t.lifesteal) t.hp = Math.min(t.maxHp, t.hp + dmg * t.lifesteal);
  if (!e.alive && t.vetOn && (t.vetN | 0) < 10) { t.vetN = (t.vetN | 0) + 1; t.maxHp *= 1.05; t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.05); }
}
function updateTroop(t) {
  if (t.flash > 0) t.flash--;
  if (t.jump) return;                      // a hero in the middle of a jump
  if (t.life > 0 && --t.life <= 0) { t.hp = 0; t.expired = true; return; }
  if (t.stunT > 0) { t.stunT--; return; }   // stunned by a Titan's War Stomp or a Storm Jammer's pulse
  if (t.cd > 0) t.cd--;
  if (t.role === 'tank') { updateTank(t); return; }
  const reg = (t.regen || 0) + t.bregen;
  if (reg && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * reg / 60);
  if (t.medAura && (G.tick + t.id) % 20 === 0) medPulse(t);
  const spd = t.speed * t.bs;
  // marching to an order: ignore enemies until it arrives (so you can pull troops back)
  if (t.order) { if (moveTo(t, t.order.x, t.order.y, spd * 1.15)) { t.home = t.order; t.order = null; } return; }
  switch (t.role) {
    case 'melee': troopMelee(t, spd); break;
    case 'ranged': case 'sentry': troopShooter(t, spd, rangedShot); break;
    case 'aoe': troopShooter(t, spd, grenadeBlast); break;
    case 'artillery': troopShooter(t, spd, gunFire); break;
    case 'medic': troopMedic(t, spd); break;
    case 'engineer': troopEngineer(t, spd); break;
  }
}
function idleHeal(t) { if (t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.002); }

// ---- melee ----
function pickMeleeTarget(t) {
  let best = null, bs = t.hunt ? -1 : 1e9;
  for (const e of G.enemies) {
    if (!e.alive || e.burrowed || e.charmT > 0 || (e.air && !t.hitsAir)) continue;
    if (e.def.stealth && e.revealedT <= 0 && !t.detect) continue;
    const dd = dist(e.x, e.y, t.home.x, t.home.y); if (dd > t.leash) continue;
    if (t.hunt) { if (e.maxHp > bs) { bs = e.maxHp; best = e; } continue; }
    if (!e.air && e.blocker && e.blocker !== t && e.blocker.hp > 0) continue;   // someone else is already holding it
    if (dd < bs) { bs = dd; best = e; }
  }
  return best;
}
function troopMelee(t, spd) {
  let e = t.target;
  if (e && (!e.alive || e.burrowed || e.charmT > 0 || (e.air && !t.hitsAir) || dist(e.x, e.y, t.home.x, t.home.y) > t.leash + 25)) { if (e.blocker === t) e.blocker = null; e = t.target = null; }
  if (!e && (G.tick + t.id) % 3 === 0) { e = pickMeleeTarget(t); if (e) { t.target = e; t.opening = true; } }
  if (!e) { moveTo(t, t.home.x, t.home.y, spd); idleHeal(t); return; }
  t.angle = Math.atan2(e.y - t.y, e.x - t.x);
  const reach = t.r + e.r + 2, dd = dist(t.x, t.y, e.x, e.y);
  if (dd > reach) { moveTo(t, e.x, e.y, t.lunge && dd > 35 ? spd * 1.4 : spd); return; }
  if (!e.air && (!e.blocker || e.blocker.hp <= 0)) e.blocker = t;
  if (t.cd <= 0) {
    t.cd = t.rate;
    let dmg = troopDamage(t);
    if (t.opening) { t.opening = false; if (t.charge) { dmg *= t.charge; floatText(e.x, e.y - e.r - 10, 'rush!', '#ffd54f'); } else if (t.backstab && e.hp >= e.maxHp * 0.9) dmg *= t.backstab; }
    const o = troopOpts(t);
    if (t.cleave) { aoeHurt(e.x, e.y, t.cleave, dmg, o, false); G.lines.push({ ring: true, x: e.x, y: e.y, r: t.cleave, life: 8, ml: 8, color: '#bdc3c7' }); }
    else hurt(e, dmg, o);
    afterHit(t, e, dmg);
    burst(e.x, e.y, '#ecf0f1', 2, 1.2, 1.8, 10); sfx('hit');
  }
}

// ---- ranged / aoe / artillery / sentry share the target picking ----
function troopShooter(t, spd, fire) {
  let e = t.target;
  if (e) { const dd = dist(e.x, e.y, t.x, t.y); if (!e.alive || e.burrowed || e.charmT > 0 || dd > t.range + 12 || dd < (t.minRange || 0)) e = t.target = null; }
  if (!e && (G.tick + t.id) % 3 === 0) {
    let bs = 1e9; const minR = t.minRange || 0;
    for (const x of G.enemies) {
      if (!x.alive || x.burrowed || x.charmT > 0 || (x.air && !t.hitsAir)) continue;
      if (x.def.stealth && x.revealedT <= 0 && !t.detect) continue;
      const dd = dist(x.x, x.y, t.x, t.y); if (dd > t.range || dd < minR) continue;
      const sc = t.role === 'artillery' ? -progress(x) : dd;
      if (sc < bs) { bs = sc; e = x; }
    }
    t.target = e;
  }
  if (!t.fixed && dist(t.x, t.y, t.home.x, t.home.y) > 2) moveTo(t, t.home.x, t.home.y, spd);
  if (!e) { idleHeal(t); return; }
  t.angle = Math.atan2(e.y - t.y, e.x - t.x);
  if (t.cd <= 0) { t.cd = t.rate; fire(t, e); }
}
function rangedShot(t, e) {
  const dmg = troopDamage(t), o = troopOpts(t); o.dodgeable = true;
  if (t.aoe) { o.dodgeable = false; o.burn = t.burn; aoeHurt(e.x, e.y, t.aoe, dmg, o, t.hitsAir); burst(e.x, e.y, t.shotColor || '#ffab91', 4, 1.5, 2, 14); }
  else { hurt(e, dmg, o); afterHit(t, e, dmg); }
  troopLine(t.x, t.y, e.x, e.y, t.shotColor);
  sfx('shoot');
}
function grenadeBlast(t, e) {
  const dmg = troopDamage(t), o = troopOpts(t);
  if (t.chain) {
    const hit = chainStrike(t.x, t.y - 4, e, dmg, t.chain, 0.8, o, t.hitsAir, t.color);
    if (t.stun) for (const h of hit) if (h.alive && !h.def.boss && Math.random() < t.stun) h.stunT = Math.max(h.stunT, t.stunTicks || 30);
    sfx('zap'); return;
  }
  o.slow = t.slow; o.slowTicks = t.slowTicks || 90; o.freeze = t.freeze; o.burn = t.burn;
  aoeHurt(e.x, e.y, t.aoe, dmg, o, t.hitsAir);
  G.lines.push({ ring: true, x: e.x, y: e.y, r: t.aoe, life: 12, ml: 12, color: t.color });
  burst(e.x, e.y, t.color, 8, 2, 2.5, 22);
  troopLine(t.x, t.y, e.x, e.y, t.color);
  sfx('boom');
}
function chainStrike(x, y, first, dmg, n, falloff, o, air, color) {
  const hit = [first]; let cur = first;
  G.lines.push({ x1: x, y1: y, x2: first.x, y2: first.y, life: 9, ml: 9, color, zig: true, w: 2 });
  hurt(first, dmg, o);
  for (let c = 0; c < n; c++) {
    let next = null, bd = 110;
    for (const e of G.enemies) {
      if (!e.alive || e.burrowed || e.charmT > 0 || hit.includes(e) || (e.air && !air)) continue;
      const dd = dist(e.x, e.y, cur.x, cur.y); if (dd < bd) { bd = dd; next = e; }
    }
    if (!next) break;
    dmg *= falloff; hurt(next, dmg, o); hit.push(next);
    G.lines.push({ x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, life: 9, ml: 9, color, zig: true, w: 2 });
    cur = next;
  }
  return hit;
}
function lobShell(sx, sy, target, dmg, aoe, o, cluster, color) {
  const flight = 55; let tx = target.x, ty = target.y;
  if (!target.air) { pathPos(G.paths[target.path], target.d + target.speed * flight * (target.stunT > 0 ? 0 : 1), _p); tx = _p.x; ty = _p.y; }
  G.projectiles.push({ x: sx, y: sy, sx, sy, tx, ty, t: 0, flight, dmg, o, kind: 'lob', aoe, color: color || '#8d6e63', mods: cluster ? { cluster } : {}, target: null, life: 200, h: 0, trail: [] });
}
function gunFire(t, e) {
  const dmg = troopDamage(t), o = troopOpts(t);
  if (t.bolt) {   // dual-purpose gun: an armor-piercing round through the line
    const a = Math.atan2(e.y - t.y, e.x - t.x), ca = Math.cos(a), sa = Math.sin(a);
    hurt(e, dmg, o); let hits = 0, ex = e.x, ey = e.y;
    for (const x of G.enemies) {
      if (hits >= t.pierce || !x.alive || x === e || x.burrowed || (x.air && !t.hitsAir)) continue;
      if (x.def.stealth && x.revealedT <= 0 && !t.detect) continue;
      const along = (x.x - t.x) * ca + (x.y - t.y) * sa; if (along < 0 || along > t.range * 1.2) continue;
      if (Math.abs(-(x.x - t.x) * sa + (x.y - t.y) * ca) > x.r + 4) continue;
      hurt(x, dmg * 0.85, o); hits++; ex = x.x; ey = x.y;
    }
    G.lines.push({ x1: t.x, y1: t.y, x2: ex, y2: ey, life: 8, ml: 8, color: '#d7ccc8', w: 2 });
    sfx('snipe');
  } else { lobShell(t.x, t.y, e, dmg, t.aoe, o, t.cluster); sfx('boom'); }
}

// ---- medic: heal the most wounded ally in reach, return fire otherwise ----
function troopMedic(t, spd) {
  if (t.reviveCd > 0) t.reviveCd--;
  if (t.cd <= 0) {
    let best = null, bf = 0.999;
    for (const a of G.troops) { if (a.hp <= 0 || a.hp >= a.maxHp || a.fixed) continue; if (dist(a.x, a.y, t.x, t.y) > t.range) continue; const f = a.hp / a.maxHp; if (f < bf) { bf = f; best = a; } }
    for (const s of G.towers) { if (!isStructure(s.def) || s.hp <= 0 || s.hp >= s.maxHp || dist(s.x, s.y, t.x, t.y) > t.range) continue; const f = s.hp / s.maxHp; if (f < bf) { bf = f; best = s; } }
    if (best) {
      best.hp = Math.min(best.maxHp, best.hp + t.heal * 0.5 * t.bd); t.cd = 30; t.angle = Math.atan2(best.y - t.y, best.x - t.x);
      troopLine(t.x, t.y, best.x, best.y, '#55efc4'); burst(best.x, best.y - 4, '#55efc4', 3, 1, 2, 16);
      return;
    }
  }
  troopShooter(t, spd, rangedShot);
}

// ---- engineer: mines, barricades, sentries, repairs ----
function troopEngineer(t, spd) {
  const c = (t.ct = (t.ct || 0) + 1);
  if (c % 30 === 0) engineerRepair(t);
  if (t.mineEvery && c % t.mineEvery === 0) plantMine(t);
  if (t.wallEvery && c % t.wallEvery === 0) buildBarricade(t);
  if (t.sentryEvery && c % t.sentryEvery === 0) buildSentry(t);
  troopShooter(t, spd, rangedShot);
}
function engineerRepair(t) {
  let best = null, bf = 0.999;
  for (const s of G.towers) { if (!isStructure(s.def) || s.hp <= 0 || s.hp >= s.maxHp || dist(s.x, s.y, t.x, t.y) > 90) continue; const f = s.hp / s.maxHp; if (f < bf) { bf = f; best = s; } }
  if (!best) for (const a of G.troops) { if (a === t || a.hp <= 0 || a.hp >= a.maxHp || a.fixed || dist(a.x, a.y, t.x, t.y) > 70) continue; const f = a.hp / a.maxHp; if (f < bf) { bf = f; best = a; } }
  if (!best) return;
  best.hp = Math.min(best.maxHp, best.hp + 35 * t.repair);
  troopLine(t.x, t.y, best.x, best.y, '#ffe082'); burst(best.x, best.y, '#ffe082', 2, 1, 2, 12);
}
function makeAuto(defId, x, y) {
  const g = new TowerGroup(TOWER[defId], x, y); g.auto = true; g.builtWave = G.wave; G.towers.push(g); syncStructure(g); return g;
}
function pathSpotNear(t, jitter) {
  const np = nearestPathPoint(G, t.home.x + rand(-jitter, jitter), t.home.y + rand(-jitter, jitter));
  if (!np || dist(np.x, np.y, t.home.x, t.home.y) > 140) return null;
  return np;
}
function plantMine(t) {
  t.mines = (t.mines || []).filter(m => !m.used && G.towers.includes(m));
  if (t.mines.length >= t.mineCap) return;
  const np = pathSpotNear(t, 70); if (!np || placementError(G, TOWER.mine, np.x, np.y)) return;
  const g = makeAuto('mine', np.x, np.y); g.mineMul = t.mineMul || 1; t.mines.push(g);
  floatText(np.x, np.y - 12, 'mine', '#ffe082'); burst(np.x, np.y, '#ffe082', 4, 1, 2, 14);
}
function buildBarricade(t) {
  t.walls = (t.walls || []).filter(m => m.hp > 0 && G.towers.includes(m));
  if (t.walls.length >= t.wallCap) return;
  const np = pathSpotNear(t, 50); if (!np || placementError(G, TOWER.sandbag, np.x, np.y)) return;
  const g = makeAuto('sandbag', np.x, np.y); g.maxHp = g.hp = Math.round(500 * (1 + G.wave * 0.06)); g.life = 40 * TPS; t.walls.push(g);
  burst(np.x, np.y, '#c8b27a', 8, 2, 2.5, 18);
}
function buildSentry(t) {
  t.sentries = (t.sentries || []).filter(s => s.hp > 0);
  if (t.sentries.length >= t.sentryCap) return;
  const a = rand(0, 6.283), x = clamp(t.x + Math.cos(a) * 18, 8, W - 8), y = clamp(t.y + Math.sin(a) * 18, 8, H - 8);
  const s = new Troop('sentry', x, y, { hp: 60 * (1 + G.wave * 0.03), dmg: Math.max(2, 5 * (1 + G.wave * 0.1)), life: 25 * TPS, owner: t.owner, fixed: true });
  G.troops.push(s); t.sentries.push(s); burst(x, y, '#ffe082', 6, 1.5, 2, 16);
}

