// ==========  5.5 NEW WEAPONS: Cryo Blaster, Plasma Rifle, Seeker Launcher (the Drum Shotgun needs nothing special)  ==========
// ---------- CRYO BLASTER: a short freezing cone. Chilled zombies move at half speed; keep spraying and they FREEZE solid ----------
// The chill and the freeze are applied where the damage is applied (damageEnemy with src 'cryo'), so in co-op the host
// freezes the zombies a guest sprays, exactly like it applies their bullets.
const CRYO_FREEZE_TICKS = 12, CRYO_FREEZE_S = 2, CRYO_CHILL_S = 1.6, FROZEN_TAKEN = 1.5;
const _cz = new V3();
function fireCryo(w, dmgMul) {
    const o = camera.position, wall = raySolids(o, _fwd, w.range), reach = wall ? wall.t : w.range, cosA = Math.cos(w.cone);
    for (let k = 1; k <= 3; k++) {
        const d = reach * k / 3.5;
        _cz.copy(_muzzleW).addScaledVector(_fwd, d); _cz.x += (Math.random() - 0.5) * d * 0.22; _cz.y += (Math.random() - 0.5) * d * 0.16; _cz.z += (Math.random() - 0.5) * d * 0.22;
        spawnParticles(_cz, k % 2 ? 0xe0f2fe : 0x7dd3fc, 1, 1.5 + d * 0.1, 0.35, 0.12 + d * 0.025, false, { grav: -0.5, drag: 2 });
    }
    let hit = false;
    for (const e of enemies.slice()) {
        const u = e.userData; if (u.dead || u.hidden) continue;
        _cz.set(e.position.x - o.x, e.position.y + u.totalHeight * 0.5 - o.y, e.position.z - o.z);
        const d = _cz.length(); if (d > reach + u.radius) continue;
        _cz.multiplyScalar(1 / (d || 1)); if (_cz.dot(_fwd) < cosA && d > u.radius * 1.5) continue;
        // your own count of zombies frozen (the host does the real freezing; this is for your stats)
        if (run.mode !== 'sandbox' && !u.config.boss && !u.config.fixed && !(u.freezeT > 0) && u.frost !== 2 && (u.myChill = (u.myChill | 0) + 1) >= CRYO_FREEZE_TICKS) { u.myChill = 0; life.frozen = (life.frozen | 0) + 1; runStats.frozen = (runStats.frozen | 0) + 1; }
        damageEnemy(e, w.damage * dmgMul, false, null, false, null, 1, 'cryo');
        hit = true;
    }
    // PvP: the spray hurts enemy players in the cone (no freezing people)
    if (NET.inGame && NET.pvp) for (const p of netPlayers.values()) {
        if (!p.av || !p.av.g.visible || p.team === NET.team || !p.alive) continue;
        const P = p.av.g.position; _cz.set(P.x - o.x, P.y + 1 - o.y, P.z - o.z);
        const d = _cz.length(); if (d > reach + 0.4) continue;
        _cz.multiplyScalar(1 / (d || 1)); if (_cz.dot(_fwd) < cosA) continue;
        netQueuePvpHit(p.id, w.damage * dmgMul * 1.2, false, false, 'cryo'); hit = true;
    }
    if (hit) runStats.hits++;
}
// host / single player: a cryo hit lands on this zombie
function chillEnemy(e, u) {
    if (u.dead || u.config.fixed) return;
    u.chillT = CRYO_CHILL_S;
    if (u.config.boss || u.freezeT > 0) return;          // bosses are only slowed
    if ((u.chillAcc = (u.chillAcc | 0) + 1) >= CRYO_FREEZE_TICKS) {
        u.chillAcc = 0; u.freezeT = CRYO_FREEZE_S;
        spawnParticles(new V3(e.position.x, e.position.y + u.totalHeight * 0.5, e.position.z), 0xe0f2fe, 8, 4, 0.6, 0.16, true, { grav: 8 });
        if (!dmgOwner) sfx('freeze');
    }
}
// frozen / chilled tint (kept on top of the hit flash)
function frostLook(u, k) {
    if (u.flash > 0) return;
    if (k === 2) { u.mat.emissive.setHex(0x9bdcff); u.mat.emissiveIntensity = 0.75; }
    else if (k === 1) { u.mat.emissive.setHex(0x38bdf8); u.mat.emissiveIntensity = 0.3; }
    else { u.mat.emissive.setHex(u.baseEmissive); u.mat.emissiveIntensity = u.baseEmissiveI; }
}
// per enemy, every frame (host / single player). Returns true while it's frozen solid (skip its AI and movement this frame).
function frostTick(e, u, delta) {
    if (u.freezeT > 0) {
        u.freezeT -= delta; u.frost = 2; frostLook(u, 2);
        if (u.freezeT <= 0) { u.frost = 0; frostLook(u, 0); spawnParticles(new V3(e.position.x, e.position.y + u.totalHeight * 0.5, e.position.z), 0xbae6fd, 6, 5, 0.5, 0.12, true, { grav: 12 }); }
        return u.freezeT > 0;
    }
    if (u.chillT > 0) { u.chillT -= delta; u.frost = 1; frostLook(u, 1); if (u.chillT <= 0) { u.chillAcc = 0; u.frost = 0; frostLook(u, 0); } }
    return false;
}

// ---------- 5.5 BLOATER: dies in a poison cloud (host / single player; the cloud goes out to guests like any boss hazard) ----------
function bloaterBurst(e) {
    const c = e.position, y = groundAt(c.x, c.z, 0, c.y + 0.5);
    spawnParticles(new V3(c.x, c.y + 1.4, c.z), 0xa3e635, 16, 7, 0.8, 0.25, false, { grav: 6 });
    bossHazard(c.x, y, c.z, 3.6, 9 * lvlDmg(), 5, 0x84cc16, "a Bloater's poison cloud");
    sfx('pop');
}

// ---------- PLASMA RIFLE: the cell recharges itself when you stop firing; empty it and it overheats (a forced vent) ----------
let plasmaAcc = 0;
function plasmaTick(w, dt) {
    const id = w.id;
    if (isReloading || ammoState[id] >= w.magSize || gameTime - lastShootTime < 0.45) { plasmaAcc = 0; return; }
    plasmaAcc += w.battery * dt;
    if (plasmaAcc >= 1) { const n = Math.floor(plasmaAcc); plasmaAcc -= n; ammoState[id] = Math.min(w.magSize, ammoState[id] + n); updateAmmoHUD(); }
}
// the gun's glowing parts follow the heat (plasma) / pulse (cryo, seeker)
function glow55Tick() {
    const m = vmModel, g = m && m.fx.glow55; if (!g) return;
    const w = W(m.id);
    if (w.battery) g.emissiveIntensity = isReloading ? 0.25 + 0.2 * Math.sin(gameTime * 20) : 0.5 + 1.6 * (ammoState[m.id] / w.magSize);
    else g.emissiveIntensity = 1.1 + 0.35 * Math.sin(gameTime * 4);
}

// ---------- SEEKER LAUNCHER: each mini-rocket picks the target nearest your crosshair and steers onto it ----------
const _sk = new V3();
function seekerPick(from, dir, maxD = 70) {
    let best = null, bs = 0.6;          // must be within ~53 degrees of where you aimed
    for (const e of enemies) {
        const u = e.userData; if (u.dead || u.hidden || !e.visible) continue;
        _sk.set(e.position.x - from.x, e.position.y + u.totalHeight * 0.55 - from.y, e.position.z - from.z);
        const d = _sk.length(); if (d > maxD || d < 1) continue;
        const s = _sk.dot(dir) / d - d / maxD * 0.15 + (u.config.boss ? 0.1 : 0);
        if (s > bs) { bs = s; best = { e }; }
    }
    if (NET.inGame && NET.pvp) for (const p of netPlayers.values()) {
        if (!p.av || !p.av.g.visible || p.team === NET.team || !p.alive) continue;
        const P = p.av.g.position; _sk.set(P.x - from.x, P.y + 1 - from.y, P.z - from.z);
        const d = _sk.length(); if (d > maxD || d < 1) continue;
        const s = _sk.dot(dir) / d - d / maxD * 0.15;
        if (s > bs) { bs = s; best = { p }; }
    }
    return best;
}
function seekerAim(t, out) {
    if (!t) return null;
    if (t.e) { const u = t.e.userData; if (u.dead || !t.e.parent) return null; return out.set(t.e.position.x, t.e.position.y + u.totalHeight * 0.55, t.e.position.z); }
    if (t.p) { if (!t.p.alive || !t.p.av) return null; const P = t.p.av.g.position; return out.set(P.x, P.y + 1, P.z); }
    return null;
}
// steer one rocket (called from the projectile loop)
function seekerSteer(p, dt) {
    if (!p.seek) return;
    p.arm -= dt;
    if (p.arm > 0) return;                       // flies straight for a moment first, so a salvo fans out
    const tp = seekerAim(p.tgt, _sk);
    if (!tp) { if ((p.retry -= dt) <= 0) { p.retry = 0.25; _sk.copy(p.vel).normalize(); p.tgt = seekerPick(p.mesh.position, _sk.clone(), 45); } return; }
    const sp = p.vel.length();
    _sk.sub(p.mesh.position).normalize().multiplyScalar(sp);
    p.vel.lerp(_sk, Math.min(1, 5.5 * dt)).setLength(sp);
}

// ---------- 5.5 test hooks ----------
function hooks55() {
    if (!window.__blocky) return;
    Object.assign(window.__blocky, { c55: {
        freeze: (e) => { const u = e.userData; for (let i = 0; i < CRYO_FREEZE_TICKS; i++) damageEnemy(e, 0.01, false, null, false, null, 1, 'cryo'); return { freezeT: u.freezeT, chillT: u.chillT }; },
        spawn: (id, x, z) => { const y = groundAt(x, z, 0, 50) + 0.1, e = spawnEnemy(enemyTypes[id], x, z, y, waveSpeed(playerStats.level), waveReward(playerStats.level)); e.userData.dropping = false; return e; },
        enemies: () => enemies.map(e => ({ id: e.userData.config.id, hp: Math.round(e.userData.hp), x: +e.position.x.toFixed(1), z: +e.position.z.toFixed(1), frozen: e.userData.freezeT > 0, chill: e.userData.chillT > 0, state: e.userData.state })),
        hazards: () => bossFx.filter(f => f.k === 'haz').map(f => ({ r: f.r, dps: f.dps, color: f.color })),
        shots: () => projectiles.filter(p => p.kind === 'bshot').length, rockets: () => projectiles.filter(p => p.kind === 'rocket').map(p => ({ seek: !!p.seek, tgt: !!p.tgt })),
        ammo: (id) => ammoState[id], setAmmo: (id, n) => { ammoState[id] = n; }, ice: () => iceRects.slice(), onIce: (x, z, f) => onIce(x, z, f || 0),
        rewards: () => Object.fromEntries(Object.keys(REWARDS55).map(k => [k, REWARDS55[k].ok()])), unlocked: (kind, id) => isUnlocked(kind, id),
        life: () => life, proto: NET_PROTO, netMsg: (peer, m) => netMessage(peer, m), verMsg: (v, h) => netVerMsg(v, h), whatsNew: () => whatsNew(), frame: (n, ms = 33) => { for (let i = 0; i < n; i++) frame((prevTime || performance.now()) + ms); prevTime = performance.now(); }
    } });
}
