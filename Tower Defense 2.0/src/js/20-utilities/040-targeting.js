// =====================================================================
//  TARGETING
// =====================================================================
function scoreTarget(mode, e, g) {
  switch (mode) {
    case 'first': return progress(e);
    case 'last': return -progress(e);
    case 'strong': return e.maxHp;
    case 'weak': return -e.maxHp;
    case 'mosthp': return e.hp + e.shield;
    case 'leasthp': return -(e.hp + e.shield);
    case 'close': return -dist(e.x, e.y, g.x, g.y);
    case 'far': return dist(e.x, e.y, g.x, g.y);
    case 'fast': return e.speed;
    case 'slow': return -e.speed;
    case 'air': return (e.air ? 10 : 0) + progress(e);
    case 'ground': return (e.air ? 0 : 10) + progress(e);
    case 'armored': return (e.armor > 0 || e.shield > 0 ? 10 : 0) + progress(e);
    case 'boss': return (e.def.boss ? 10 : 0) + e.maxHp / 1e6 + progress(e);
    default: return 0;
  }
}
function findTargets(g, st, n, exclude) {
  const range = st.range * g.buff.range, minR = st.minRange, air = st.air;
  if (g.sticky && g.target && g.target.alive && n === 1 && canTarget(g, g.target, air)) {
    const dd = dist(g.target.x, g.target.y, g.x, g.y); if (dd <= range && dd >= minR) return [g.target];
  }
  const cands = [];
  for (const e of G.enemies) {
    if (!canTarget(g, e, air) || (exclude && exclude.includes(e))) continue;
    const dd = dist(e.x, e.y, g.x, g.y); if (dd > range + e.r * 0.5 || dd < minR) continue;
    cands.push(e);
  }
  if (!cands.length) return cands;
  if (g.targeting === 'random') { for (let i = cands.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cands[i], cands[j]] = [cands[j], cands[i]]; } }
  else if (n === 1) { let best = cands[0], bs = scoreTarget(g.targeting, best, g); for (let i = 1; i < cands.length; i++) { const s = scoreTarget(g.targeting, cands[i], g); if (s > bs) { bs = s; best = cands[i]; } } g.target = best; return [best]; }
  else cands.sort((a, b) => scoreTarget(g.targeting, b, g) - scoreTarget(g.targeting, a, g));
  g.target = cands[0];
  return cands.slice(0, n);
}

// =====================================================================
//  PROJECTILES
// =====================================================================
function fire(g, u, st, target, extra) {
  const m = st.mods, k = g.def.shootKind || g.def.kind;
  const o = { src: u, group: g, pierceArmor: !!m.pierceArmor, crit: m.crit, critMult: m.critMult, heavyBonus: m.heavyBonus, shieldMul: m.shieldMul, airBonus: m.airBonus, dodgeable: true };
  const dmg = st.damage * g.buff.dmg * (extra && extra.mult || 1);
  const a = Math.atan2(target.y - g.y, target.x - g.x); g.angle = a; g.recoil = 4;
  const mx = g.x + Math.cos(a) * 14, my = g.y + Math.sin(a) * 14;
  const p = { x: mx, y: my, target, tx: target.x, ty: target.y, dmg, o, kind: k, aoe: st.aoe, color: g.def.color, mods: m, speed: 11, life: 200, trail: [], airOnly: st.air === 'only', bug: !!m.bug, shard: !!m.resonate };
  if (k === 'shell') p.speed = 8;
  if (k === 'missile') { p.speed = 5; p.vx = Math.cos(a + rand(-0.6, 0.6)) * 4; p.vy = Math.sin(a + rand(-0.6, 0.6)) * 4; }
  if (k === 'poison') p.speed = 9;
  if (k === 'lob') {
    // aim where the enemy will be when the shell lands
    const flight = 50; const lead = target.air ? 0 : target.speed * flight * (target.stunT > 0 ? 0 : 1);
    let tx = target.x, ty = target.y;
    if (!target.air) { pathPos(G.paths[target.path], target.d + lead, _p); tx = _p.x; ty = _p.y; }
    if (extra && extra.spread) { tx += rand(-extra.spread, extra.spread); ty += rand(-extra.spread, extra.spread); }
    p.sx = mx; p.sy = my; p.tx = tx; p.ty = ty; p.t = 0; p.flight = flight; p.target = null;
  }
  G.projectiles.push(p);
}
function updateProjectile(p) {
  p.life--;
  if (p.kind === 'lob') {
    p.t++; const f = p.t / p.flight; p.x = p.sx + (p.tx - p.sx) * f; p.y = p.sy + (p.ty - p.sy) * f; p.h = Math.sin(f * Math.PI) * 60;
    if (p.t >= p.flight) { explode(p, p.tx, p.ty, false); return false; }
    return true;
  }
  if (p.target && p.target.alive) { p.tx = p.target.x; p.ty = p.target.y; }
  else if (p.kind !== 'shell' && p.kind !== 'missile') { if (p.target) p.target = null; }
  if (p.kind === 'missile') {
    const a = Math.atan2(p.ty - p.y, p.tx - p.x), ca = Math.atan2(p.vy, p.vx);
    let da = a - ca; da = Math.atan2(Math.sin(da), Math.cos(da));
    const na = ca + clamp(da, -0.12, 0.12), sp = Math.min(9, Math.hypot(p.vx, p.vy) + 0.25);
    p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; p.x += p.vx; p.y += p.vy;
    if (S.trails && Math.random() < 0.6) burst(p.x, p.y, '#bdc3c7', 1, 0.3, 2, 18);
    if (dist(p.x, p.y, p.tx, p.ty) < 10 || p.life <= 0) { explode(p, p.x, p.y, true); return false; }
    return true;
  }
  const dx = p.tx - p.x, dy = p.ty - p.y, dd = Math.hypot(dx, dy);
  if (S.trails && p.trail) { p.trail.push(p.x, p.y); if (p.trail.length > 8) p.trail.splice(0, 2); }
  if (dd <= p.speed) {
    p.x = p.tx; p.y = p.ty;
    if (p.kind === 'shell') { explode(p, p.x, p.y, !!(p.o.group && p.o.group.def.air !== 'no')); return false; }
    if (p.target && p.target.alive) {
      const e = p.target, m = p.mods;
      if (p.kind === 'poison') {
        hurt(e, p.dmg * 0.25, p.o);
        e.poison = { dps: p.dmg * 0.75 / 180, t: 180, src: p.o.src, group: p.o.group, plague: !!m.plague };
        if (m.slow && !e.def.noSlow) { e.slowT = Math.max(e.slowT, m.slowTicks); e.slowP = Math.max(e.slowP, m.slow); }
      } else {
        hurt(e, p.dmg, p.o);
        if (m.burn && e.alive) e.burn = { dps: p.dmg * m.burn / 120, t: 120, src: p.o.src, group: p.o.group };
        if (m.splash) { aoeHurt(e.x, e.y, m.splash, p.dmg * 0.5, Object.assign({}, p.o, { dodgeable: false }), true); if (G.lines.length < 160) G.lines.push({ ring: true, x: e.x, y: e.y, r: m.splash, life: 10, ml: 10, color: p.color }); }
        if (m.resonate) resonate(e, p, m);
      }
      burst(e.x, e.y, p.color, 3, 1.5, 2, 16);
    }
    return false;
  }
  p.x += dx / dd * p.speed; p.y += dy / dd * p.speed;
  return p.life > 0;
}
// Crystal Resonator: every hit adds a stack, the last one shatters the target in a burst
function resonate(e, p, m) {
  e.reso = (e.reso | 0) + 1;
  if (e.reso < m.resonate) return;
  e.reso = 0;
  const R = m.resoR || 60, o = Object.assign({}, p.o, { dodgeable: false, noVar: true });
  if (m.resoSlow) { o.slow = m.resoSlow; o.slowTicks = 120; }
  aoeHurt(e.x, e.y, R, p.dmg * (m.resoMul || 4), o, true);
  burst(e.x, e.y, '#64ffda', 16, 3.2, 2.6, 24); burst(e.x, e.y, '#e0f7fa', 8, 2, 2, 18);
  G.lines.push({ ring: true, x: e.x, y: e.y, r: R, life: 16, ml: 16, color: '#64ffda' }); sfx('zap');
}
function explode(p, x, y, includeAir) {
  const m = p.mods, o = Object.assign({}, p.o, { dodgeable: false, slow: m.slow, slowTicks: m.slowTicks, stunAll: m.stunAll, burn: m.burn, acid: m.acidHit, airOnly: p.airOnly != null ? p.airOnly : !!(p.o.group && p.o.group.def.air === 'only') });
  aoeHurt(x, y, p.aoe, p.dmg, o, includeAir);
  burst(x, y, p.color, 14, 3, 3, 26); burst(x, y, '#f39c12', 8, 2.5, 2.5, 20);
  G.lines.push({ ring: true, x, y, r: p.aoe, life: 14, ml: 14, color: p.color });
  sfx('boom'); if (p.aoe > 100) shake(3);
  if (m.cluster) for (let i = 0; i < m.cluster; i++) {
    const cx = x + rand(-p.aoe, p.aoe), cy = y + rand(-p.aoe, p.aoe);
    aoeHurt(cx, cy, p.aoe * 0.5, p.dmg * 0.4, o, false); burst(cx, cy, '#f39c12', 5, 2, 2, 16);
  }
  if (m.napalm) G.patches.push({ x, y, r: p.aoe * 0.8, t: 180, dps: p.dmg * 0.5 / 60, o: p.o });
  if (m.puddle) { if (G.patches.length > 40) G.patches.shift(); G.patches.push({ x, y, r: p.aoe * 0.7 * (m.puddle > 1 ? 1.6 : 1), t: 180 * m.puddle, dps: p.dmg * 0.6 / 60, o: p.o, acid: true }); }
}

// =====================================================================
//  TOWER UPDATE
// =====================================================================
function updateTower(g) {
  if (g.recoil > 0) g.recoil *= 0.8;
  if (g.redeploy > 0) { g.redeploy--; return; }
  if (g.disabledT > 0) { g.disabledT--; return; }     // knocked out by a Flying Saucer
  const def = g.def, k = def.kind;
  if (k === 'income' || k === 'aura' || k === 'mine' || k === 'tank' || k === 'hq' || k === 'trap') return;
  if (k === 'fence') { structureTick(g); if (def.shoots) towerAttack(g, g.units[0]); return; }
  if (k === 'barracks') { updateBarracks(g); return; }
  if (k === 'heal') { updateHeal(g); return; }
  for (const u of g.units) { towerAttack(g, u); if (u.spec && u.stats.mods.pulse) pulseTick(g, u); }
}
function towerAttack(g, u) {
  const st = u.stats, m = st.mods, k = g.def.shootKind || g.def.kind;
  if (u.cd > 0) u.cd--;
  if (g.def.manual) { manualCharge(u, st); return; }     // supers that need a click: just recharge
  if (k === 'beam') { beamAttack(g, u, st); return; }
  if (k === 'mind') { mindAttack(g, u, st); return; }
  if (u.cd > 0) { if (m.spin) u.spin = Math.max(0, u.spin - 0.5); return; }
  const shots = (k === 'missile' || k === 'lob') ? st.shots : 1;
  const tg = findTargets(g, st, 1);
  if (!tg.length) { if (m.spin) u.spin = Math.max(0, u.spin - 2); return; }
  const t = tg[0];
  u.cd = st.rate / g.buff.rate;
  if (k === 'bullet') {
    let mult = 1; if (m.spin) { u.spin = Math.min(180, u.spin + st.rate); mult = 1 + 1.2 * u.spin / 180; }
    for (let i = 0; i < st.shots; i++) fire(g, u, st, t, { mult: mult * (i ? 1 : 1) });
    sfx('shoot');
  } else if (k === 'shell' || k === 'missile' || k === 'poison') { for (let i = 0; i < shots; i++) fire(g, u, st, t); sfx(k === 'missile' ? 'shoot' : 'shoot'); }
  else if (k === 'lob') { for (let i = 0; i < shots; i++) fire(g, u, st, t, { spread: m.spread }); sfx('boom'); }
  else if (k === 'snipe') {
    g.angle = Math.atan2(t.y - g.y, t.x - g.x); g.recoil = 6;
    const o = { src: u, group: g, pierceArmor: !!m.pierceArmor, crit: m.crit, critMult: m.critMult, heavyBonus: m.heavyBonus, shieldMul: m.shieldMul };
    const tx0 = t.x, ty0 = t.y;
    hurt(t, st.damage * g.buff.dmg, o);
    if (m.heBurst) { aoeHurt(tx0, ty0, m.heBurst, st.damage * g.buff.dmg * 0.6, { src: u, group: g, heavyBonus: m.heavyBonus }, st.air !== 'no'); burst(tx0, ty0, '#ffb74d', 8, 2.4, 2.4, 18); G.lines.push({ ring: true, x: tx0, y: ty0, r: m.heBurst, life: 12, ml: 12, color: '#ffb74d' }); }
    let ex = t.x, ey = t.y;
    if (m.pierce) {   // keep going through the line
      const a = g.angle, hit = [t];
      for (const e of G.enemies) {
        if (hit.length > m.pierce || !e.alive || e === t || !canTarget(g, e, 'yes')) continue;
        const along = (e.x - g.x) * Math.cos(a) + (e.y - g.y) * Math.sin(a); if (along < 0 || along > st.range * g.buff.range * 1.3) continue;
        const off = Math.abs(-(e.x - g.x) * Math.sin(a) + (e.y - g.y) * Math.cos(a)); if (off > e.r + 4) continue;
        hit.push(e); hurt(e, st.damage * g.buff.dmg * 0.8, o); ex = e.x; ey = e.y;
      }
    }
    G.lines.push({ x1: g.x, y1: g.y, x2: ex, y2: ey, life: 8, ml: 8, color: m.tracer || '#e0c3fc', w: 2 }); burst(t.x, t.y, g.def.color, 5, 2);
    sfx('snipe');
  } else if (k === 'frost') {
    g.angle = Math.atan2(t.y - g.y, t.x - g.x);
    const o = { src: u, group: g, slow: m.slowPower || 0.5, slowTicks: 90, freeze: m.freeze, brittle: m.brittle, noVar: true };
    aoeHurt(t.x, t.y, st.aoe, st.damage * g.buff.dmg, o, false);
    G.lines.push({ ring: true, x: t.x, y: t.y, r: st.aoe, life: 16, ml: 16, color: '#a5d8ff' }); burst(t.x, t.y, '#dff4ff', 8, 1.6, 2, 24);
  } else if (k === 'gravity') {
    gravityPulse(g, u, st, t);
  } else if (k === 'zap' || k === 'chain') {
    const chainN = m.chain != null ? m.chain : (g.def.chain || 0), falloff = m.chainFalloff || 0.7;
    const o = { src: u, group: g, pierceArmor: false, shieldMul: m.shieldMul };
    let cur = t, dmg = st.damage * g.buff.dmg; const hit = [t];
    const zc = m.zapColor || (k === 'zap' ? '#fff59d' : '#d6a2ff');
    g.angle = Math.atan2(t.y - g.y, t.x - g.x);
    G.lines.push({ x1: g.x, y1: g.y - 8, x2: t.x, y2: t.y, life: k === 'zap' ? 4 : 9, ml: 9, color: zc, zig: true, w: m.zapColor ? 3 : 2 });
    hurt(t, dmg, o); applyChainExtras(t, m);
    for (let c = 0; c < chainN; c++) {
      let next = null, bd = 120;
      for (const e of G.enemies) { if (!e.alive || hit.includes(e) || !canTarget(g, e, st.air)) continue; const dd = dist(e.x, e.y, cur.x, cur.y); if (dd < bd) { bd = dd; next = e; } }
      if (!next) break;
      dmg *= falloff; hurt(next, dmg, o); applyChainExtras(next, m); hit.push(next);
      G.lines.push({ x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, life: 9, ml: 9, color: zc, zig: true, w: 2 });
      cur = next;
    }
    sfx('zap');
  }
}
function applyChainExtras(e, m) {
  if (m.ionStun && e.alive && !e.def.boss && isMachine(e)) e.stunT = Math.max(e.stunT, m.ionStun);
  if (m.acidHit && e.alive) e.armor = Math.max(0, e.armor - m.acidHit);
  if (m.mark) { e.markT = m.markTicks; e.mark = Math.max(e.mark, m.mark); }
  if (m.stun && !e.def.boss && Math.random() < m.stun) { e.stunT = Math.max(e.stunT, m.stunTicks); floatText(e.x, e.y - e.r - 8, 'stun', '#fff59d'); }
}
function beamAttack(g, u, st) {
  const m = st.mods;
  let targets;
  if (u.rampTarget && u.rampTarget.alive && canTarget(g, u.rampTarget, st.air) && dist(u.rampTarget.x, u.rampTarget.y, g.x, g.y) <= st.range * g.buff.range) targets = [u.rampTarget];
  else { targets = findTargets(g, st, 1); u.ramp = 0; }
  if (!targets.length) { u.rampTarget = null; u.ramp = 0; return; }
  const t = targets[0]; u.rampTarget = t; g.angle = Math.atan2(t.y - g.y, t.x - g.x);
  const extra = m.prism ? findTargets(g, st, 1 + m.prism, [t]).slice(0, m.prism) : [];
  const all = [t].concat(extra), Lr = st.range * g.buff.range;
  // the beam is drawn every tick; damage lands every `rate` ticks
  for (const e of all) G.beams.push({ x1: g.x, y1: g.y, x2: e.x, y2: e.y, color: g.def.color, w: g.def.super ? 5 : 3, pierce: g.def.pierceBeam, a: Math.atan2(e.y - g.y, e.x - g.x), len: Lr });
  const ramps = g.def.ramp || m.focus;
  if (ramps) u.ramp = Math.min(1, u.ramp + (m.rampSpeed || 1) / 240);
  // Disintegrator: every half second it unravels a slice of the target's max health
  if (m.unravel && (u.unravT = (u.unravT || 0) + 1) >= 30) {
    u.unravT = 0; const lv = 1 + 0.1 * (u.level - 1);
    for (const e of all) if (e.alive) { hurt(e, e.maxHp * (e.def.boss ? m.unravelBoss : m.unravel) * lv * g.buff.dmg, { src: u, group: g, pierceArmor: true, noVar: true, atomize: m.atomize }); burst(e.x, e.y, '#ea80fc', 4, 1.6, 2, 16); }
  }
  if (u.cd > 0) return;
  u.cd = st.rate / g.buff.rate;
  const mult = ramps ? 1 + (g.def.ramp ? 3 : (m.focusMax || 3)) * u.ramp : 1;
  const o = { src: u, group: g, pierceArmor: !!m.pierceArmor, noVar: true, atomize: m.atomize };
  for (const e of all) hurt(e, st.damage * g.buff.dmg * mult, o);
  if (g.def.pierceBeam) {    // plasma burns everything along each lance
    for (const tg of all) {
      const a = Math.atan2(tg.y - g.y, tg.x - g.x), ca = Math.cos(a), sa = Math.sin(a);
      for (const e of G.enemies) {
        if (!e.alive || e === tg || !canTarget(g, e, 'yes')) continue;
        const along = (e.x - g.x) * ca + (e.y - g.y) * sa; if (along < 0 || along > Lr) continue;
        if (Math.abs(-(e.x - g.x) * sa + (e.y - g.y) * ca) < e.r + 6) hurt(e, st.damage * g.buff.dmg * mult, o);
      }
    }
  }
  if (st.aoe > 0 && (m.splashAll || g.def.id === 'inferno')) {
    for (const e of G.enemies) if (e.alive && e !== t && !e.air && dist(e.x, e.y, t.x, t.y) < st.aoe) { hurt(e, st.damage * g.buff.dmg * mult * (m.splashAll ? 0.8 : 0.35), o); }
  }
  if (Math.random() < 0.3) burst(t.x, t.y, g.def.color, 1, 1.2, 2, 14);
}
// Graviton Projector: a pulse at the target throws everything in it back along the road
function gravityPulse(g, u, st, t) {
  const m = st.mods, R = st.aoe, air = st.air !== 'no', dmg = st.damage * g.buff.dmg, x = t.x, y = t.y;
  g.angle = Math.atan2(y - g.y, x - g.x);
  const o = { src: u, group: g, noVar: true, pierceArmor: true };
  for (const e of G.enemies) {
    if (!e.alive || e.burrowed || e.charmT > 0 || (e.air && !air) || dist(e.x, e.y, x, y) > R + e.r) continue;
    hurt(e, dmg, o);
    if (!e.alive) continue;
    if (m.brittle) { e.brittleT = Math.max(e.brittleT, 240); e.brittle = Math.max(e.brittle, m.brittle); }
    if (pushBack(e, m.push || 45, 60)) { e.stunT = Math.max(e.stunT, 10); burst(e.x, e.y, '#b388ff', 3, 1.5, 2, 14); }
  }
  G.lines.push({ ring: true, x, y, r: R, life: 18, ml: 18, color: '#7c4dff' }); G.lines.push({ ring: true, x, y, r: R * 0.5, life: 12, ml: 12, color: '#b388ff' });
  G.lines.push({ x1: g.x, y1: g.y, x2: x, y2: y, life: 8, ml: 8, color: 'rgba(179,136,255,0.7)', w: 3 });
  sfx('zap');
}
// Psi Spire: seizes the toughest enemies in range
function mindAttack(g, u, st) {
  if (u.cd > 0) return;
  const m = st.mods, R = st.range * g.buff.range, n = m.charmN || 1;
  let picked = 0;
  for (let k = 0; k < n; k++) {
    let best = null;
    for (const e of G.enemies) {
      if (!canTarget(g, e, st.air) || (e.def.boss && !m.charmBoss) || dist(e.x, e.y, g.x, g.y) > R) continue;
      if (!best || e.maxHp > best.maxHp) best = e;
    }
    if (!best) break;
    const ticks = best.def.boss ? m.charmBoss : (m.charm || 240) + 30 * (u.level - 1);
    if (charmEnemy(best, ticks, { src: u, group: g, noVar: true }, m.backlash)) { picked++; g.angle = Math.atan2(best.y - g.y, best.x - g.x); G.lines.push({ x1: g.x, y1: g.y - 10, x2: best.x, y2: best.y, life: 16, ml: 16, color: '#e040fb', zig: true, w: 2 }); }
  }
  if (picked) { u.cd = st.rate / g.buff.rate; sfx('zap'); }
}
// Solar Nova (Plasma spec): a periodic shockwave that hits every enemy in range
function pulseTick(g, u) {
  const st = u.stats, m = st.mods;
  if (++u.pulseT < m.pulseEvery) return;
  const R = st.range * g.buff.range; let any = false;
  for (const e of G.enemies) if (e.alive && !e.burrowed && dist(e.x, e.y, g.x, g.y) <= R) { any = true; break; }
  if (!any) { u.pulseT = m.pulseEvery; return; }
  u.pulseT = 0;
  aoeHurt(g.x, g.y, R, st.damage * g.buff.dmg * m.pulse, { src: u, group: g, pierceArmor: true, noVar: true, stunHit: 40 }, true);
  G.lines.push({ ring: true, x: g.x, y: g.y, r: R, life: 24, ml: 24, color: g.def.color }); burst(g.x, g.y, g.def.color, 24, 5, 3, 30); shake(3); sfx('boom');
}
// supers that need a click keep a stock of shots (1 normally, 3 with Capacitor Bank)
function manualCharge(u, st) {
  const max = st.mods.charges || 1;
  if (u.stock > max) u.stock = max;
  if (u.stock < max && u.cd <= 0) { u.stock++; if (u.stock < max) u.cd = st.rate; }
}
const superReady = (g) => g.units[0].stock > 0;
function updateHeal(g) {
  const u = g.units[0], st = u.stats; if (u.cd > 0) { u.cd--; return; }
  let any = false; const range = st.range * g.buff.range;
  const heal = (obj) => { if (obj.hp > 0 && obj.hp < obj.maxHp && dist(obj.x, obj.y, g.x, g.y) <= range) { obj.hp = Math.min(obj.maxHp, obj.hp + st.damage); any = true; G.lines.push({ x1: g.x, y1: g.y, x2: obj.x, y2: obj.y, life: 10, ml: 10, color: '#55efc4', w: 2 }); burst(obj.x, obj.y, '#55efc4', 3, 1); } };
  for (const t of G.towers) if (t.def.kind === 'fence' || t.def.kind === 'trap') heal(t);
  for (const tr of G.troops) heal(tr);
  if (any) u.cd = 60 / g.buff.rate;
}
function formationOffset(i, n) {
  if (n <= 1) return { x: 0, y: 0 };
  const cols = Math.ceil(Math.sqrt(n)), row = Math.floor(i / cols), col = i % cols, rows = Math.ceil(n / cols);
  return { x: (col - (cols - 1) / 2) * 20, y: (row - (rows - 1) / 2) * 20 };
}

