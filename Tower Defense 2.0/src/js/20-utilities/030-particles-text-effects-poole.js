// =====================================================================
//  PARTICLES, TEXT, EFFECTS (pooled, capped by the quality setting)
// =====================================================================
const parts = []; const partPool = [];
function burst(x, y, color, n, speed = 2, size = 2.5, life = 30) {
  const cap = particleCap(); if (!cap) return;
  n = Math.ceil(n * [0, 0.35, 1, 1.6][S.particles]);
  for (let i = 0; i < n && parts.length < cap; i++) {
    const p = partPool.pop() || {}; const a = Math.random() * 6.283, v = Math.random() * speed;
    p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.c = color; p.s = size * rand(0.6, 1.2); p.l = p.ml = life * rand(0.6, 1.2);
    parts.push(p);
  }
}
function floatText(x, y, text, color, big) {
  if (!S.damageNumbers && !big) return;
  if (G.texts.length > 80) G.texts.shift();
  G.texts.push({ x, y, text, color, life: big ? 70 : 40, big });
}
function shake(n) { if (S.shake && !S.reducedMotion) G.shake = Math.min(14, G.shake + n); }
function menuNote(msg) { const n = $('menu-note'); if (n) n.textContent = msg || ''; }
function toast(msg, color, ms) { const t = $('toast'); t.textContent = msg; t.style.color = color || 'var(--gold)'; t.style.borderColor = color || 'var(--gold)'; t.style.opacity = '1'; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.opacity = '0', ms || 2200); }
function announce(text, sub, color) { const b = $('announce'); b.innerHTML = text + (sub ? '<small>' + sub + '</small>' : ''); b.style.color = color || '#fff'; b.style.opacity = '1'; clearTimeout(announce.t); announce.t = setTimeout(() => b.style.opacity = '0', 2200); }

// =====================================================================
//  DAMAGE
// =====================================================================
function canTarget(g, e, air) {
  if (!e.alive || e.burrowed || e.charmT > 0) return false;
  if (e.air) { if (air === 'no') return false; } else if (air === 'only') return false;
  if (e.def.stealth && !g.def.detect && !g.buff.detect && e.revealedT <= 0) return false;
  return true;
}
// o: { src: Unit, group, pierceArmor, crit, critMult, heavyBonus, aoe (bool), noVar, dodgeable }
function hurt(e, amount, o) {
  if (!e.alive || e.burrowed || amount <= 0 || e.charmT > 0) return 0;
  if (o.dodgeable && e.def.dodge && Math.random() < e.def.dodge) { floatText(e.x, e.y - e.r - 4, 'dodge', '#bbb'); return 0; }
  let d = amount;
  if (S.variance && !o.noVar) d *= 0.9 + Math.random() * 0.2;
  let crit = false;
  if (o.crit && Math.random() < o.crit) { d *= o.critMult || 2; crit = true; }
  if (o.heavyBonus && (e.def.boss || e.armor > 0 || e.maxShield > 0 || e.maxBarrier > 0)) d *= o.heavyBonus;
  if (o.airBonus && e.air) d *= o.airBonus;
  d *= 1 + (e.brittleT > 0 ? e.brittle : 0) + (e.markT > 0 ? e.mark : 0) + (e.revealedT > 0 ? e.radarMark : 0);
  if (e.rallyT > 0) d *= 0.7;              // under a Warlord's battle standard
  e.hitT = G.tick;
  const sm = o.shieldMul || 1;
  // alien barrier: soaks the WHOLE hit (no damage gets through) until it breaks
  if (e.barrier > 0) {
    const bd = d * sm; e.barrier -= bd; e.flash = 4;
    if (o.src) { o.src.dealt += bd; if (o.group) o.group.dealt += bd; }
    G.stats.damage += bd;
    if (S.damageNumbers) { e.numAcc = (e.numAcc || 0) + bd; if (G.tick - (e.numT || -99) >= 12 && e.numAcc >= 1) { floatText(e.x + rand(-6, 6), e.y - e.r - 6, fmt(e.numAcc), '#84ffff'); e.numAcc = 0; e.numT = G.tick; } }
    if (e.barrier <= 0) breakBarrier(e);
    return bd;
  }
  if (!o.pierceArmor && e.armor > 0) d = Math.max(d * 0.25, d - e.armor);
  let dealt = d;
  if (e.shield > 0) { const a = Math.min(e.shield, d * sm); e.shield -= a; d -= a / sm; if (e.shield <= 0 && e.def.aegis) aegisBreak(e); }
  e.hp -= d; e.flash = 4;
  if (o.src) { o.src.dealt += dealt; if (o.group) o.group.dealt += dealt; }
  G.stats.damage += dealt;
  // damage numbers: crits show at once; everything else is added up per enemy and shown every 12 ticks (no number spam from beams)
  if (S.damageNumbers) {
    if (crit) floatText(e.x + rand(-6, 6), e.y - e.r - 6, fmt(dealt) + '!', '#ffd54f');
    else { e.numAcc = (e.numAcc || 0) + dealt; if (G.tick - (e.numT || -99) >= 12 && e.numAcc >= 1) { floatText(e.x + rand(-6, 6), e.y - e.r - 6, fmt(e.numAcc), '#fff'); e.numAcc = 0; e.numT = G.tick; } }
  }
  if (e.hp <= 0) killEnemy(e, o);
  return dealt;
}
function killEnemy(e, o) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0;
  // Biomass Reclaimers add a bounty, Marked for Death doubles it
  const pay = Math.max(1, Math.round(e.reward * G.rewardMul * (1 + (e.harvest || 0)) * (e.bountyT > 0 ? 2 : 1)));
  G.money += pay; G.stats.earned += pay; G.stats.kills++;
  if (e.harvest > 0 && Math.random() < 0.5) burst(e.x, e.y, '#aeea00', 4, 1.5, 2, 18);
  if (o && o.src) { o.src.kills++; if (o.group) o.group.kills++; }
  if (G.hero) heroKillXp(e, o);
  if (e.def.splits && e.gen < e.def.splits) for (let i = 0; i < 2; i++) spawnSplit(e, i ? 9 : -9);
  if (o && o.atomize) { aoeHurt(e.x, e.y, 60, e.maxHp * o.atomize, { src: o.src, group: o.group, noVar: true }, true); burst(e.x, e.y, '#ea80fc', 14, 3, 2.5, 22); }
  if (e.id === 'mothership') unlock('mothership');
  if (e.def.boss) { G.stats.bosses = (G.stats.bosses || 0) + 1; recordBoss(e.id); }
  burst(e.x, e.y, e.def.color, e.def.boss ? 40 : 10, e.def.boss ? 4 : 2.2, e.def.boss ? 4 : 2.5);
  if (e.def.boss) { shake(8); sfx('boom'); floatText(e.x, e.y - 30, '+' + money$(pay), '#ffd54f', true); }
  if (e.def.split) for (let i = 0; i < e.def.splitN; i++) spawnChild(e, e.def.split, rand(-10, 10));
  if (e.def.onDeath) for (let i = 0; i < e.def.onDeathN; i++) spawnChild(e, e.def.onDeath, rand(-18, 18));
  if (e.poison && e.poison.plague) {
    for (const o2 of G.enemies) if (o2.alive && o2 !== e && dist(o2.x, o2.y, e.x, e.y) < 70) o2.poison = Object.assign({}, e.poison, { t: 180 });
    burst(e.x, e.y, '#6c5ce7', 12, 2.5);
  }
  if (e.blocker && e.blocker.target === e) e.blocker.target = null;
}
function spawnChild(parent, id, off) {
  if (G.enemies.length > 480 && parent.def.summon) return;      // keep summoners from flooding a weak Chromebook
  const c = makeEnemy(id, Math.max(1, parent.wave - 1), { path: parent.path, d: Math.max(0, parent.d + off), noVary: true });
  if (parent.air || c.air) { c.x = parent.x + rand(-8, 8); c.y = parent.y + rand(-8, 8); c.d = parent.air ? parent.d : 0; }
  c.reward = Math.max(1, Math.round(c.reward * 0.5));
  G.enemies.push(c);
}
// a Splitter breaks into two smaller, faster copies of itself (one generation deeper)
function spawnSplit(e, off) {
  if (G.enemies.length > 480) return;
  const c = makeEnemy(e.id, e.wave, { path: e.path, d: Math.max(0, e.d + off), noVary: true });
  c.gen = e.gen + 1; c.maxHp = c.hp = e.maxHp * 0.5; c.r = e.r * 0.76; c.speed = e.speed * 1.2;
  c.reward = Math.max(1, Math.round(e.reward * 0.2)); c.dmg = Math.max(1, Math.round(e.dmg * 0.5)); c.armor = e.armor;
  placeEnemy(c); c.stunT = 12;
  G.enemies.push(c);
}
// put an enemy where its path distance says it is (after a push, a warp or a charm step)
function placeEnemy(e) {
  const p = G.paths[e.path];
  if (e.air) { const end = p.pts[p.pts.length - 1], f = clamp(e.d / (p.air.len || 1), 0, 1); e.x = p.air.ax + (end.x - p.air.ax) * f; e.y = p.air.ay + (end.y - p.air.ay) * f; e.angle = Math.atan2(end.y - p.air.ay, end.x - p.air.ax); }
  else { pathPos(p, e.d, _p); e.x = _p.x; e.y = _p.y; e.angle = Math.atan2(_p.dy, _p.dx); }
}
// throw an enemy back toward its spawn (Graviton, Warp Mine, Wormhole). cd = ticks before it can be thrown again
function pushBack(e, amount, cd) {
  if (!e.alive || e.charmT > 0 || amount <= 0) return false;
  if (cd) { if (e.pushT > G.tick) return false; e.pushT = G.tick + cd; }
  if (e.def.boss) amount /= 3;
  e.d = Math.max(0, e.d - amount); e.chew = 0;
  placeEnemy(e);
  return true;
}
// ---- alien barriers ----
function breakBarrier(e) {
  e.barrier = 0;
  if (e.tempBarrier) { e.maxBarrier = 0; e.tempBarrier = false; } else e.barrierDownT = 300;
  burst(e.x, e.y, '#84ffff', e.def.boss ? 30 : 10, 3, 2.5, 22);
  if (G.lines.length < 160) G.lines.push({ ring: true, x: e.x, y: e.y, r: e.r * 1.5, life: 14, ml: 14, color: '#84ffff' });
  if (e.def.boss || e.r >= 15) floatText(e.x, e.y - e.r - 14, 'BARRIER DOWN', '#84ffff', e.def.boss);
}
function restoreBarrier(e) { e.barrier = e.maxBarrier; burst(e.x, e.y, '#18ffff', 6, 1.6, 2, 16); }
// Barrier Drone: hands a temporary barrier to everything around it and snaps broken alien barriers back
function projectBarrier(e) {
  let n = 0;
  for (const o of G.enemies) {
    if (!o.alive || o === e || o.def.boss || o.charmT > 0 || o.barrier > 0 || dist(o.x, o.y, e.x, e.y) > 95) continue;
    if (o.maxBarrier > 0 && !o.tempBarrier) o.barrier = o.maxBarrier;
    else { o.barrier = o.maxBarrier = o.maxHp * 0.25; o.tempBarrier = true; }
    o.barrierDownT = 0; n++;
    if (G.lines.length < 160) G.lines.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, life: 10, ml: 10, color: '#18ffff', w: 1.5 });
  }
  if (n) G.lines.push({ ring: true, x: e.x, y: e.y, r: 95, life: 18, ml: 18, color: '#26c6da' });
}
// Warp Stalker: jumps 160 ahead along the road, straight past walls
function warpJump(e) {
  const p = G.paths[e.path], from = { x: e.x, y: e.y };
  e.warpT = 240; e.d = Math.max(e.d, Math.min(p.len - 30, e.d + e.def.warp)); e.chew = 0;
  if (e.blocker) { if (e.blocker.target === e) e.blocker.target = null; e.blocker = null; }
  placeEnemy(e);
  burst(from.x, from.y, '#aa00ff', 10, 2.5, 2.5, 20); burst(e.x, e.y, '#ea80fc', 10, 2.5, 2.5, 20);
  if (G.lines.length < 160) G.lines.push({ x1: from.x, y1: from.y, x2: e.x, y2: e.y, life: 12, ml: 12, color: 'rgba(234,128,252,0.6)', w: 2 });
}
// Flying Saucer: its tractor beam knocks out the nearest tower below it for 3 seconds (Shield Pylons protect)
function abductTower(e) {
  let best = null, bd = 80;
  for (const g of G.towers) { if (g.auto || g.def.onPath || g.pylon || g.disabledT > 0) continue; const d = dist(g.x, g.y, e.x, e.y); if (d < bd) { bd = d; best = g; } }
  if (!best) { e.abductT = 45; return; }
  e.abductT = 300; best.disabledT = 180; best.dsc = '#b2ff59';
  G.lines.push({ x1: e.x, y1: e.y, x2: best.x, y2: best.y, life: 30, ml: 30, color: '#b2ff59', w: 6 });
  floatText(best.x, best.y - 24, 'KNOCKED OUT', '#b2ff59'); burst(best.x, best.y, '#b2ff59', 8, 2, 2, 20);
  if (!G.hinted.abduct) { G.hinted.abduct = 1; toast('A Flying Saucer knocked out a tower! Shoot saucers down (SAM, Flak, CIWS), or cover towers with a Shield Pylon.', '#b2ff59', 5000); }
}
// ---- mind control (Psi Spire, Zyx'ara): the enemy turns around and fights its own side ----
function charmEnemy(e, ticks, o, backlash) {
  if (!e.alive || ticks <= 0) return false;
  e.charmT = Math.max(e.charmT, ticks); e.charmO = o; e.charmBack = backlash || 0; e.stunT = 0;
  e.charmPow = Math.max(10, e.maxHp * 0.06);
  if (e.blocker) { if (e.blocker.target === e) e.blocker.target = null; e.blocker = null; }
  burst(e.x, e.y, '#e040fb', 12, 2.5, 2.5, 22); floatText(e.x, e.y - e.r - 10, 'mind control', '#ea80fc');
  return true;
}
function charmStep(e) {
  e.charmT--;
  e.d = Math.max(0, e.d - e.speed * 0.8); placeEnemy(e); e.angle += Math.PI;
  if ((G.tick + e.uid) % 20 === 0) for (const o of G.enemies) {
    if (!o.alive || o === e || o.charmT > 0 || o.burrowed || o.air !== e.air || dist(o.x, o.y, e.x, e.y) > e.r + o.r + 8) continue;
    hurt(o, e.charmPow, e.charmO); burst(o.x, o.y, '#ea80fc', 2, 1.2, 2, 12);
  }
  if (e.charmT <= 0) {
    e.charmT = 0; burst(e.x, e.y, '#e040fb', 8, 2, 2, 16);
    if (e.charmBack) hurt(e, e.maxHp * e.charmBack, Object.assign({}, e.charmO, { pierceArmor: true, noVar: true }));
  }
}
function aoeHurt(x, y, radius, amount, o, includeAir) {
  let n = 0;
  for (const e of G.enemies) {
    if (!e.alive || e.burrowed || e.charmT > 0) continue;
    if (e.air && !includeAir) continue;
    if (!e.air && o.airOnly) continue;
    const dd = dist(e.x, e.y, x, y); if (dd > radius + e.r) continue;
    hurt(e, amount, Object.assign({}, o, { aoe: true }));
    if (o.slow && !e.def.noSlow) { e.slowT = Math.max(e.slowT, o.slowTicks || 90); e.slowP = Math.max(e.slowP, o.slow); }
    if (o.burn && e.alive) e.burn = { dps: amount * o.burn / 120, t: 120, src: o.src, group: o.group };
    if (o.freeze && !e.def.noSlow && Math.random() < o.freeze) e.stunT = Math.max(e.stunT, 72);
    if (o.stunHit && !e.def.boss) e.stunT = Math.max(e.stunT, o.stunHit);
    if (o.brittle) { e.brittleT = 150; e.brittle = Math.max(e.brittle, o.brittle); }
    if (o.stunAll && !e.def.boss) e.stunT = Math.max(e.stunT, o.stunAll);
    if (o.acid) e.armor = Math.max(0, e.armor - o.acid);
    n++;
  }
  return n;
}

// =====================================================================
//  BOSS TRICKS (2.6) - only bosses run this, so it costs nothing per tick
// =====================================================================
function bossTick(e) {
  const d = e.def;
  if (d.aegis) {                                   // Aegis Walker: the shield comes back after 3 quiet seconds
    if (e.bossLock > 0) e.bossLock--;
    else if (e.shield < e.maxShield && G.tick - e.hitT > 180) { e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.0018); if ((G.tick & 15) === 0) burst(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), '#82b1ff', 1, 0.8, 2, 14); }
    return;
  }
  if (d.stomp) { if (e.bossK < STOMP_AT.length && e.hp < e.maxHp * STOMP_AT[e.bossK]) titanStomp(e); return; }
  if (d.steam) {                                   // Railway Gun: whistle (1 s), then 2 s at triple speed
    if (e.bossPh === 2) { if (--e.bossT <= 0) { e.bossPh = 0; e.bossT = 480; } else steamRam(e); }
    else if (e.bossPh === 1) { if ((G.tick & 3) === 0) burst(e.x + rand(-8, 8), e.y + rand(-8, 8), '#cfd8dc', 2, 1.2, 4, 26); if (--e.bossT <= 0) { e.bossPh = 2; e.bossT = 120; floatText(e.x, e.y - e.r - 14, 'FULL STEAM!', '#ffab40', true); shake(3); if (e.blocker) { if (e.blocker.target === e) e.blocker.target = null; e.blocker = null; } } }
    else if (--e.bossT <= 0) { e.bossPh = 1; e.bossT = 60; floatText(e.x, e.y - e.r - 14, 'whistle!', '#eceff1'); sfx('wave'); }
    return;
  }
  if (d.jammer) {                                  // Storm Jammer: 6 s quiet, 1 s charging ring, then the pulse
    if (e.jam > 0) { e.bossPh = 0; if (e.bossT < 120) e.bossT = 120; return; }
    e.bossPh = --e.bossT <= 60 ? 1 : 0;
    if (e.bossT <= 0) { jammerPulse(e); e.bossT = 420; e.bossPh = 0; }
    return;
  }
  if (d.factory) {                                 // War Factory: escorts every 6 s, a Heavy Tank at 2/3 and 1/3 health (3.0.1: was 3 tanks, at every quarter)
    if (e.bossPh > 0) e.bossPh--;
    if (!e.jam && --e.bossT <= 0) { e.bossT = 360; factorySquad(e); }
    while (e.bossK < FACTORY_TANK_AT.length && e.hp < e.maxHp * FACTORY_TANK_AT[e.bossK]) { e.bossK++; spawnEscort(e, 'heavytank', -26); e.bossPh = 40; floatText(e.x, e.y - e.r - 14, 'HEAVY TANK!', '#ffab40', true); }
    return;
  }
  if (d.warlord) {                                 // Warlord: a buff aura, and a healing rally every 8 s
    if ((G.tick + e.uid) % 20 === 0) { let n = 0; for (const o of G.enemies) if (o.alive && o !== e && o.charmT <= 0 && dist(o.x, o.y, e.x, e.y) < 150) { o.rallyT = 30; n++; } e.bossK = n; }
    if (!e.jam && --e.bossT <= 0) {
      e.bossT = 480; let n = 0;
      for (const o of G.enemies) if (o.alive && o !== e && o.charmT <= 0 && dist(o.x, o.y, e.x, e.y) < 150) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15); n++; if (n < 12) burst(o.x, o.y, '#ff8a65', 3, 1.2, 2, 16); }
      if (G.lines.length < 160) G.lines.push({ ring: true, x: e.x, y: e.y, r: 150, life: 22, ml: 22, color: '#ff7043' });
      floatText(e.x, e.y - e.r - 14, 'RALLY!', '#ff7043', true);
    }
  }
}
// Railway Gun at full steam: walls in its way are smashed, troops are run over and thrown aside
function steamRam(e) {
  if ((G.tick & 1) === 0) burst(e.x - Math.cos(e.angle) * e.r, e.y - Math.sin(e.angle) * e.r, '#b0bec5', 1, 1, 4, 24);
  for (const f of G.walls) if (f.hp > 0 && dist(f.x, f.y, e.x, e.y) <= e.r + 16) { f.hp -= f.maxHp * 0.05; f.hitT = 90; if (f.hp <= 0) destroyFence(f); }
  for (const t of G.troops) {
    if (t.hp <= 0 || t.kind === 'tank' || t.jump) continue;
    const dd = dist(t.x, t.y, e.x, e.y); if (dd > e.r + t.r + 4) continue;
    t.hp -= t.maxHp * 0.04; t.flash = 3;
    const nx = -Math.sin(e.angle), ny = Math.cos(e.angle), sd = (t.x - e.x) * nx + (t.y - e.y) * ny >= 0 ? 1 : -1;
    t.x = clamp(t.x + nx * sd * 4, 8, W - 8); t.y = clamp(t.y + ny * sd * 4, 8, H - 8);
    if (t.hp <= 0) onTroopDeath(t);
  }
}
function titanStomp(e) {
  e.bossK++; e.speed *= 1.25; shake(9); sfx('boom');
  burst(e.x, e.y, '#ffab40', 30, 5, 3.5, 30);
  if (G.lines.length < 160) { G.lines.push({ ring: true, x: e.x, y: e.y, r: 150, life: 26, ml: 26, color: '#ff6d00' }); G.lines.push({ ring: true, x: e.x, y: e.y, r: 90, life: 20, ml: 20, color: '#ffd180' }); }
  floatText(e.x, e.y - e.r - 16, 'WAR STOMP!', '#ff6d00', true);
  for (const t of G.troops) if (t.hp > 0 && !t.jump && dist(t.x, t.y, e.x, e.y) < 150) { t.stunT = Math.max(t.stunT || 0, 120); t.hp -= t.maxHp * 0.15; t.flash = 4; if (t.hp <= 0) onTroopDeath(t); }
  for (const f of G.walls) if (f.hp > 0 && dist(f.x, f.y, e.x, e.y) < 150) { f.hp -= f.maxHp * 0.5; f.hitT = 90; if (f.hp <= 0) destroyFence(f); }
}
function jammerPulse(e) {
  const R = 160; let n = 0, saved = 0;
  for (const g of G.towers) {
    if (dist(g.x, g.y, e.x, e.y) > R) continue;
    if (g.pylon) { saved++; burst(g.x, g.y, '#18ffff', 4, 1.5, 2, 14); continue; }
    g.disabledT = Math.max(g.disabledT || 0, 150); g.dsc = '#40c4ff'; n++;
  }
  for (const t of G.troops) if (t.hp > 0 && dist(t.x, t.y, e.x, e.y) < R) t.stunT = Math.max(t.stunT || 0, 60);
  if (G.lines.length < 160) { G.lines.push({ ring: true, x: e.x, y: e.y, r: R, life: 24, ml: 24, color: '#40c4ff' }); G.lines.push({ ring: true, x: e.x, y: e.y, r: R * 0.6, life: 18, ml: 18, color: '#e1f5fe' }); }
  burst(e.x, e.y, '#80d8ff', 26, 4, 2.5, 24); sfx('zap');
  floatText(e.x, e.y - e.r - 14, 'EMP PULSE', '#40c4ff', true);
  if (n && !G.hinted.jammer) { G.hinted.jammer = 1; toast('The Storm Jammer knocked out ' + n + ' tower' + (n === 1 ? '' : 's') + '! Towers under a Shield Pylon are safe, and a Radar Jammer or EMP Blast stops its charge.', '#40c4ff', 6000); }
}
function aegisBreak(e) {
  e.shield = 0; e.stunT = Math.max(e.stunT, 120);
  burst(e.x, e.y, '#82b1ff', 28, 4, 3, 26); shake(4);
  if (G.lines.length < 160) G.lines.push({ ring: true, x: e.x, y: e.y, r: e.r * 1.8, life: 18, ml: 18, color: '#82b1ff' });
  floatText(e.x, e.y - e.r - 16, 'SHIELD DOWN - OVERLOAD', '#82b1ff', true);
}
function spawnEscort(parent, id, off) {
  if (G.enemies.length > 360) return null;
  const c = makeEnemy(id, Math.max(1, parent.wave - 2), { path: parent.path, d: Math.max(0, parent.d + off), noVary: true });
  c.reward = Math.max(1, Math.round(c.reward * 0.5)); placeEnemy(c); G.enemies.push(c);
  return c;
}
function factorySquad(e) {
  const w = e.wave, pool = w < 25 ? ['basic', 'basic', 'fast'] : w < 45 ? ['basic', 'fast', 'assault'] : w < 70 ? ['assault', 'commando', 'tank'] : ['assault', 'tank', 'armored'];
  for (let i = 0, n = w < 25 ? 2 : 3; i < n; i++) spawnEscort(e, pool[(Math.random() * pool.length) | 0], -14 - i * 10);   // 3.0.1: squads of 2 before wave 25
  e.bossPh = 30; burst(e.x, e.y, '#ffcc80', 8, 2, 2.5, 18);
}
// a boss wave's boss steps onto the road: a short tip the first time each boss shows up in a game
function bossArrives(e) {
  const d = e.def; if (!d.tip || G.hinted['b_' + d.id]) return;
  G.hinted['b_' + d.id] = 1;
  setTimeout(() => G && toast(d.name + ' - ' + d.trick + ': ' + d.tip, '#ff8a80', 6500), 600);
}

