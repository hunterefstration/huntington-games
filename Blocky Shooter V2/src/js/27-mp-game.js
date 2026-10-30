// ---------- HOST: game loop pieces ----------
const _targets = [];
function netAiTargets(localT) {
    _targets.length = 0; _targets.push(localT);
    if (!NET.pvp) for (const p of netPlayers.values()) if (p.tgt.feet > -50) _targets.push(p.tgt);
    return _targets;
}
function netSendDamage(pid, amount, from, kb, by, jam) {
    const p = netPlayers.get(pid); if (!p) return;
    sendRel(p.peer, { t: 'd', a: r2(amount), f: from ? [r2(from.x), r2(from.z)] : null, kb: kb ? kb.map(r2) : undefined, by, jam: jam || undefined });
}
function hostApplyHits(pid, list) {
    if (!Array.isArray(list)) return;
    for (const h of list) {
        const e = enemyById.get(h[0]); if (!e || e.userData.dead) continue;
        dmgOwner = pid;
        try { damageEnemy(e, Math.min(+h[1] || 0, 30000), !!h[2], new V3(h[3], h[4], h[5]), !!h[6], null, 1, NET_SRC[h[7]] || 'explosive'); }
        finally { dmgOwner = 0; }
    }
}
function netEnemyKilled(id, by, head, src) { netBroadcast({ t: 'k', id, by, h: head ? 1 : 0, s: srcIdx(src) }); }
function netWaveStarted(level) {
    if (NET.host) netBroadcast({ t: 'wave', n: level });
    netReviveIfDown();
}
function netWaveCleared(levelAfter) { if (NET.host) netBroadcast({ t: 'clr', n: levelAfter }); }
function netSendFx(kind, pos, r, color, extra) {
    const m = { t: 'fx', k: kind, p: [r2(pos.x), r2(pos.y), r2(pos.z)], r: r2(r), c: color };
    if (extra) Object.assign(m, extra);
    if (NET.host) netBroadcast(m); else sendRel(NET.hostPeer, m);
}
// 5.2: a blast/slam/emp show is played once per event: a repeat of the same one (same kind, same spot, within half a second), a flood of them
// (more than ~8 a second) or a silly radius is dropped, so a replayed or spammed message can never strobe the screen.
const _fxSeen = []; let _fxBurstT = 0, _fxBurstN = 0;
function netFxAllowed(m) {
    if (!m || !Array.isArray(m.p) || m.p.length < 3) return false;
    const t = gameTime;
    if (t - _fxBurstT > 1) { _fxBurstT = t; _fxBurstN = 0; }
    if (++_fxBurstN > 8) return false;
    for (let i = _fxSeen.length - 1; i >= 0; i--) {
        const f = _fxSeen[i];
        if (t - f.t > 0.5) { _fxSeen.splice(i, 1); continue; }
        if (f.k === m.k && Math.abs(f.x - m.p[0]) < 0.6 && Math.abs(f.z - m.p[2]) < 0.6) return false;
    }
    _fxSeen.push({ k: m.k, x: m.p[0], z: m.p[2], t });
    return true;
}
function netPlayFx(m) {
    if (!netFxAllowed(m)) return;
    if (m.k === 'boom' || m.k === 'slam' || m.k === 'emp') m.r = clamp(+m.r || 4, 1, 40);
    const p = new V3(+m.p[0] || 0, +m.p[1] || 0, +m.p[2] || 0);
    if (m.k === 'boom') explode(p, 0, m.r, { fxOnly: true, color: m.c });
    else if (m.k === 'slam') {
        spawnBlastFx(p, m.r, m.c, true, 0.5);
        spawnParticles(new V3(p.x, p.y + 0.2, p.z), 0x9ca3af, 12, 6, 0.7, 0.3, true, { grav: 6, drag: 2, jitter: m.r * 0.5 });
        sfxAt('slam', camera.position.distanceTo(p));
    }
    else if (m.k === 'emp') empBurst(p, clamp(+m.r || 6, 2, 12));
    // 4.0 classes: a teammate's Healing Field (heals you here when you stand in it) and Recon UPLINK marks
    else if (m.k === 'heal' && !NET.pvp) {
        addHealField(p.x, p.y, p.z, clamp(+m.r || 6, 2, 12), clamp(+m.d || 8, 1, 15), clamp(+m.h || 8, 0, 20), clamp(+m.a || 0, 0, 10), false);
        sfxAt('field', camera.position.distanceTo(p));
    } else if (m.k === 'radar' && !NET.pvp) {
        const n = radarMark(p.x, p.z, clamp(+m.r || 70, 5, 999), clamp(+m.d || 6, 1, 12));
        spawnBlastFx(p, Math.min(+m.r || 70, 80), 0xa78bfa, true, 1.2);
        radarSweep = Math.max(radarSweep, 0.6);
        sfxAt('radar', camera.position.distanceTo(p) * 0.5);
        if (n && currentGameState === 'playing') toast(`TEAMMATE RADAR  \u00b7  ${n} MARKED`, '#c4b5fd', 1.4);
    }
}
function netSendSpit(from, v) { netBroadcast({ t: 'sp', p: [r2(from.x), r2(from.y), r2(from.z)], v: [r2(v.x), r2(v.y), r2(v.z)] }); }
function netSpitFx(m) {
    const orb = new THREE.Mesh(_orbGeo, _spitMat);
    orb.position.set(m.p[0], m.p[1], m.p[2]); scene.add(orb);
    projectiles.push({ kind: 'spit', mesh: orb, vel: new V3(m.v[0], m.v[1], m.v[2]), life: (SPIT_RANGE + 4) / 24, damage: 0, from: orb.position.clone(), fxOnly: true });
    sfxAt('spit', camera.position.distanceTo(orb.position));
}
function netSendTracer(a, b, c) { netBroadcast({ t: 'tr', a: [r2(a.x), r2(a.y), r2(a.z)], b: [r2(b.x), r2(b.y), r2(b.z)], c }); }
function netExplodeRemotes(pos, damage, radius, by) {
    for (const p of netPlayers.values()) {
        if (!p.tgt.alive) continue;
        const d = Math.hypot(p.tgt.pos.x - pos.x, p.tgt.feet + 0.9 - pos.y, p.tgt.pos.z - pos.z);
        if (d < radius) netSendDamage(p.id, damage * (1 - 0.8 * d / radius), pos, [0, 9 * (1 - d / radius), 0], by);
    }
}
// one binary packet with every enemy: 14 bytes each (id, type, state, position, facing, health, target, extra bits: 1 = linked to a Shocker, 2 = enraged)
function hostEnemySnapshot(now) {
    const list = enemies, n = Math.min(list.length, 150);
    const buf = new ArrayBuffer(13 + n * 14), dv = new DataView(buf);
    dv.setUint8(0, 1); dv.setFloat64(1, now); dv.setUint16(9, playerStats.level); dv.setUint16(11, n);
    let o = 13;
    for (let i = 0; i < n; i++, o += 14) {
        const e = list[i], u = e.userData;
        const st = Math.max(0, E_STATES.indexOf(u.hidden ? 'hidden' : u.state));
        dv.setUint16(o, u.netId); dv.setUint8(o + 2, ENEMY_IDS.indexOf(u.config.id));
        dv.setUint8(o + 3, st | (u.onGround ? 16 : 0) | (u.leaping ? 32 : 0) | (u.fuse >= 0 ? 64 : 0) | (u.shielded ? 128 : 0));
        dv.setInt16(o + 4, clamp(Math.round(e.position.x * 32), -32767, 32767));
        dv.setInt16(o + 6, clamp(Math.round(e.position.y * 32), -32767, 32767));
        dv.setInt16(o + 8, clamp(Math.round(e.position.z * 32), -32767, 32767));
        const r = ((e.rotation.y / (Math.PI * 2)) % 1 + 1) % 1;
        dv.setUint8(o + 10, Math.round(r * 256) & 255);
        dv.setUint8(o + 11, Math.round(clamp(u.hp / u.maxHp, 0, 1) * 255));
        dv.setUint8(o + 12, u.tgt ? (u.tgt.id & 255) : 255);
        dv.setUint8(o + 13, (u.linkUntil > gameTime && u.linkBy && !u.linkBy.userData.dead ? 1 : 0) | (u.phase2 ? 2 : 0));
    }
    for (const p of netPlayers.values()) sendFast(p.peer, buf);
}


// ---------- GUEST: enemies are copies of the host's ----------
const _ev = [0, 0, 0, 0], _ev0 = new V3();
function netSpawnRemoteEnemy(id, typeId, x, y, z) {
    const cfg = enemyTypes[typeId] || enemyTypes.grunt;
    const e = createEnemy(cfg);
    e.position.set(x, y, z);
    const u = e.userData;
    u.netId = id;
    u.maxHp = ENEMY_BASE_HP * cfg.hp * bossHpMul(cfg); u.hp = u.maxHp;
    u.reward = waveReward(playerStats.level) * cfg.reward;
    u.speed = 0;
    u.net = { buf: new Interp([3]), seen: performance.now(), fl: 16, tg: 255, predT: 0, aimT: 0 };
    enemyById.set(id, e);
    scene.add(e); enemies.push(e);
    if (cfg.boss) bossIntro(cfg);
    return e;
}
function netClientHit(e, amount, head, point, expl, src) {
    const u = e.userData;
    if (u.dead) return;
    const now = performance.now();
    const kill = u.hp - amount <= 0;
    u.hp = Math.max(1, u.hp - amount); u.net.predT = now + 450;           // show the health drop right away
    u.flash = 0.09; u.mat.emissive.setHex(0xffffff); u.mat.emissiveIntensity = 0.8; u.barShow = true;
    runStats.damage += Math.min(amount, u.maxHp);
    if (!expl) { showHitMarker(head, kill); if (!kill) sfx(head ? 'head' : 'hit'); }
    if (point) spawnDamageNumber(point, Math.round(amount), expl ? 'boom' : (head ? 'head' : ''));
    const p = point || e.position;
    NET.hitOut.push([u.netId, r2(amount), head ? 1 : 0, r2(p.x), r2(p.y), r2(p.z), expl ? 1 : 0, srcIdx(src)]);
}
function clientKill(m) {
    NET.deadIds.set(m.id, performance.now());
    const e = enemyById.get(m.id); if (!e) return;
    const u = e.userData, c = new V3(e.position.x, e.position.y + u.totalHeight * 0.5, e.position.z);
    killEnemy(e, true, !!m.h, NET_SRC[m.s]);
    if (m.by === NET.id) {
        awardKill(u, c, !!m.h, NET_SRC[m.s] || 'explosive');
        dropLoot(u, e.position);
        updateHUD();
    }
}
function netUpdateEnemies(dt) {
    const now = performance.now(), rt = now + (NET.hostPeer && NET.hostPeer.off !== undefined ? NET.hostPeer.off : 0) - INTERP_MS;
    let stale = null;
    for (const e of enemies) {
        const u = e.userData; if (!u.net || u.dead) continue;
        if (now - u.net.seen > 2500) { (stale || (stale = [])).push(e); continue; }
        const ox = e.position.x, oz = e.position.z;
        if (u.net.buf.sample(rt, _ev)) { e.position.set(_ev[0], _ev[1], _ev[2]); e.rotation.y = _ev[3]; }
        const sp = Math.hypot(e.position.x - ox, e.position.z - oz) / Math.max(dt, 1e-3);
        const fl = u.net.fl, cfg = u.config;
        u.state = E_STATES[fl & 15] || 'walk'; u.onGround = !!(fl & 16); u.leaping = !!(fl & 32); u.shielded = !!(fl & 128);
        e.visible = !(u.state === 'cloak' || u.state === 'hidden' || u.state === 'burrow' || u.state === 'erupt');      // cloaked Phantom, Vent Crawler in its vent, Patient Zero underground
        if (u.state === 'hidden' && cfg.ai === 'crawler' && (u.rattleT = (u.rattleT || 0) - dt) <= 0) {      // the vent rattles for everyone, not just the host
            u.rattleT = 1.4 + Math.random() * 1.6; const hd = Math.hypot(camera.position.x - e.position.x, camera.position.z - e.position.z);
            if (hd < 24) { sfxAt('thud', hd); spawnParticles(_ev0.set(e.position.x, e.position.y + 0.15, e.position.z), 0x9ca3af, 2, 1.5, 0.4, 0.1, true, { grav: 4 }); }
        }
        if (u.bubble) { u.bubble.visible = u.shielded; u.bubble.material.opacity = 0.16 + 0.08 * Math.sin(gameTime * 5); }
        if (u.flash > 0) { u.flash -= dt; if (u.flash <= 0) { u.mat.emissive.setHex(u.baseEmissive); u.mat.emissiveIntensity = u.baseEmissiveI; } }
        // animation from how fast it's actually sliding along
        const moving = sp > 0.4 && u.onGround;
        u.walkPhase += Math.min(sp, 14) * dt * 1.6 / cfg.scale;
        const sw = Math.sin(u.walkPhase) * (moving ? 0.75 : 0.1);
        u.legL.rotation.x = sw; u.legR.rotation.x = -sw * u.limp;
        if (!u.onGround) { u.legL.rotation.x = 0.5; u.legR.rotation.x = -0.3; }
        const reach = -Math.PI / 2;
        if (cfg.ai === 'ranged' || cfg.ai === 'medic') { u.armL.rotation.x = -sw; u.armR.rotation.x = sw; }
        else if (cfg.ai === 'marksman') { const aim = u.state === 'aim'; u.armR.rotation.x = aim ? -Math.PI / 2 : -0.4; u.armL.rotation.x = aim ? -1.3 : -sw; u.armL.rotation.z = aim ? -0.5 : 0; }
        else if (cfg.ai === 'shielder') { u.armL.rotation.x = -1.2; u.armR.rotation.x = reach * 0.6 - sw * 0.25; }
        else if (cfg.ai === 'hound') houndPose(u, sw);
        else if (cfg.ai === 'crawler') { u.armL.rotation.x = -2.3 + sw * 0.5; u.armR.rotation.x = -2.3 - sw * 0.5; }
        else if (cfg.ai === 'shocker') { if (u.state === 'zap') { u.armL.rotation.x = u.armR.rotation.x = -1.45; u.zapT = gameTime + 0.1; } else zombieArms(u, reach, sw); }
        else if (u.state === 'slam') { u.armL.rotation.x = u.armR.rotation.x = -Math.PI * 0.9; }
        else if (cfg.ai === 'warlord') { u.armR.rotation.x = u.state === 'aim' ? -Math.PI / 2 : -0.45 - sw * 0.1; u.armL.rotation.x = -sw * 0.6; }
        else if (cfg.ai === 'acolyte') acolytePose(u);
        else if (cfg.ai === 'egg') { /* no limbs */ }
        else if (cfg.ai === 'necro') { u.armR.rotation.x = -0.25; u.armL.rotation.x = -1.2 + sw * 0.2; }
        else if (u.state === 'charge') { u.armL.rotation.x = u.armR.rotation.x = 0.6; }
        else if (u.state === 'windup') { u.armL.rotation.x = u.armR.rotation.x = -2.4 + Math.sin(gameTime * 20) * 0.2; }
        else if (u.leaping) { u.armL.rotation.x = u.armR.rotation.x = -2.6; }
        else zombieArms(u, reach, sw);
        if (cfg.ai === 'pyro' && Math.random() < 0.4) spawnParticles(new V3(e.position.x, e.position.y + 3.1 * cfg.scale, e.position.z), Math.random() < 0.5 ? 0xff6a1f : 0xffd24d, 1, 2.5, 0.5, 0.35 * cfg.scale, false, { grav: -6 });
        if (u.arcs) shockerTick(e, u, dt, true);
        if (cfg.ai === 'zero') { if (u.extra) u.extra.scale.setScalar(1 + Math.sin(gameTime * 4) * 0.1); if (e.visible && Math.random() < 0.4) spawnParticles(_ev0.set(e.position.x, e.position.y + 2.8 * cfg.scale, e.position.z), 0xa3e635, 1, 2, 0.6, 0.3 * cfg.scale, false, { grav: -3 }); }
        if (u.extra && (cfg.ai === 'brood' || cfg.ai === 'pyro')) u.extra.scale.setScalar(1 + Math.sin(gameTime * 6) * 0.13);
        if (u.state === 'stun') u.head.rotation.y = Math.sin(gameTime * 14) * 0.4; else { u.head.rotation.y = 0; zombieHead(u); }
        if (cfg.ai === 'bomber' && u.extra) u.extra.visible = !(fl & 64) || Math.floor(gameTime * 20) % 2 === 0;
        if (cfg.id === 'spitter' && u.extra) u.extra.scale.setScalar(1 + Math.sin(gameTime * 5) * 0.12);
        if (u.aura) u.aura.material.opacity = 0.35 + 0.25 * Math.sin(gameTime * 4);
        // marksman laser points at whoever it's aiming at
        if (u.laser) {
            if (u.state === 'aim') {
                u.net.aimT += dt;
                const tp = u.net.tg === NET.id ? camera.position : (netPlayers.get(u.net.tg) && netPlayers.get(u.net.tg).av ? netPlayers.get(u.net.tg).av.g.position.clone().setY(netPlayers.get(u.net.tg).av.g.position.y + 1.4) : null);
                if (tp) {
                    u.aimFrom.set(e.position.x + Math.sin(e.rotation.y) * 1.3 * cfg.scale, e.position.y + 2.25 * cfg.scale, e.position.z + Math.cos(e.rotation.y) * 1.3 * cfg.scale);
                    u.aimTo.lerp(tp, Math.min(1, dt * 3));
                    const L = u.laser, len = u.aimFrom.distanceTo(u.aimTo), hot = u.net.aimT > 1.55;
                    L.visible = true; L.position.copy(u.aimFrom).lerp(u.aimTo, 0.5);
                    L.quaternion.setFromUnitVectors(_Z, _dir.copy(u.aimTo).sub(u.aimFrom).normalize());
                    L.scale.set(hot ? 0.07 : 0.03, hot ? 0.07 : 0.03, len);
                    L.material.opacity = hot ? (Math.floor(gameTime * 30) % 2 ? 1 : 0.5) : 0.45;
                }
            } else { u.net.aimT = 0; u.laser.visible = false; }
        }
    }
    if (stale) for (const e of stale) { scene.remove(e); disposeEnemy(e); enemyById.delete(e.userData.netId); enemies = enemies.filter(x => x !== e); }
    for (const [id, t] of NET.deadIds) if (now - t > 4000) NET.deadIds.delete(id);
}
function clientWaveStart(n) {
    playerStats.level = n; waveActive = true; intermission = 0; waveHurt = false;
    scheduleSupply();
    toast(n % 5 === 0 ? `WAVE ${n} - BOSS INCOMING` : `WAVE ${n}`, n % 5 === 0 ? '#e879f9' : '#ffffff', 2.2);
    sfx('wave');
    netReviveIfDown();
    updateHUD();
}
function clientWaveClear(n) {
    waveActive = false;
    const bonus = Math.round((40 + (n - 1) * 15) * DIFF().cash);
    playerStats.money += bonus;
    gainXP(40 + 10 * (n - 1));
    chWave(n - 1);                                  // 4.0 challenges
    playerStats.level = n; intermission = 15;
    projectiles.filter(p => p.kind === 'spit').forEach(removeProjectile);
    toast(`WAVE CLEARED!  +$${bonus}`, '#4ade80', 2.2);
    sfx('wave');
    updateHUD();
}


// ---------- shots you can see and hear from other players ----------
function netRecordShot(from, to) {
    NET.fireT = 0.12;
    if (NET.myShots.length < 4) NET.myShots.push([r2(from.x), r2(from.y), r2(from.z), r2(to.x), r2(to.y), r2(to.z)]);
}
const _sa = new V3(), _sb = new V3();
function netShowShot(p, seg) {
    if (!seg || seg.length < 6) return;
    _sa.set(seg[0], seg[1], seg[2]); _sb.set(seg[3], seg[4], seg[5]);
    spawnTracer(_sa, _sb, NET.pvp && p && p.team !== NET.team ? 0xff9a8a : 0xffe9a8, 0.022, 0.09);
    if (p) {
        p.fireT = 0.08;
        const now = performance.now();
        if (!p.sndT || now - p.sndT > 55) { p.sndT = now; sfxAt(WEAPON_ORDER[p.w] || 'ar', camera.position.distanceTo(_sa)); }
    }
}


// ---------- PvP: hitting other players (what you see on your screen counts) ----------
function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
    let t0 = 0, t1 = 1e9;
    for (const [oa, da, a0, a1] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
        if (Math.abs(da) < 1e-9) { if (oa < a0 || oa > a1) return -1; continue; }
        let n = (a0 - oa) / da, f = (a1 - oa) / da; if (n > f) { const t = n; n = f; f = t; }
        if (n > t0) t0 = n; if (f < t1) t1 = f; if (t0 > t1) return -1;
    }
    return t0;
}
function netTraceAvatars(o, d, maxT, w, dmgMul) {
    let best = null, bt = maxT, head = false;
    for (const p of netPlayers.values()) {
        if (!p.av || !p.av.g.visible || p.team === NET.team || !p.alive) continue;
        const P = p.av.g.position;
        const th = rayBox(o, d, P.x - 0.27, P.y + 1.52, P.z - 0.27, P.x + 0.27, P.y + 2.0, P.z + 0.27);
        const tb = rayBox(o, d, P.x - 0.38, P.y, P.z - 0.38, P.x + 0.38, P.y + 1.55, P.z + 0.38);
        if (th >= 0 && th < bt && (tb < 0 || th <= tb + 0.3)) { bt = th; best = p; head = true; }
        else if (tb >= 0 && tb < bt) { bt = tb; best = p; head = false; }
    }
    if (!best) return null;
    const pt = o.clone().addScaledVector(d, bt);
    const dmg = w.damage * dmgMul * (head ? w.hsMult : 1);
    netQueuePvpHit(best.id, dmg, head, false, w.id);
    showHitMarker(head, false); sfx(head ? 'head' : 'hit');
    spawnDamageNumber(pt, Math.round(dmg), head ? 'head' : '');
    spawnParticles(pt, TEAM_COLORS[best.team], 4, 5, 0.35, 0.1, true, { grav: 20 });
    runStats.hits++;
    return pt;
}
function netExplodeAvatars(pos, damage, radius, src) {
    for (const p of netPlayers.values()) {
        if (!p.av || !p.alive || p.team === NET.team) continue;
        const P = p.av.g.position, d = Math.hypot(P.x - pos.x, P.y + 0.9 - pos.y, P.z - pos.z);
        if (d < radius) { const dmg = damage * 0.45 * (1 - 0.7 * d / radius); netQueuePvpHit(p.id, dmg, false, true, src || 'explosive'); spawnDamageNumber(P.clone().setY(P.y + 1.4), Math.round(dmg), 'boom'); }
    }
}
function netQueuePvpHit(pid, dmg, head, expl, src) {
    const cur = NET.pvpOut.get(pid);
    if (cur) { cur[0] += dmg; cur[1] = cur[1] || head; }
    else NET.pvpOut.set(pid, [dmg, head, expl, srcIdx(src)]);
}
function hostApplyPvpHits(shooter, list) {
    if (!Array.isArray(list)) return;
    const sPos = shooter.tgt ? shooter.tgt.pos : camera.position;
    for (const [pid, dmg, head, expl, si] of list) {
        const target = playerById(pid);
        if (!target || target.team === shooter.team || !target.alive) continue;
        if (NET.mode === 'tourney' && (TN.phase !== 'duel' || !tnIsDuelist(shooter.id) || !tnIsDuelist(pid) || !shooter.alive)) continue;      // 5.2: only the two duelists, only while the fight is on
        const d = Math.min(+dmg || 0, 1500);
        if (pid === NET.id) netPvpDamaged(d, shooter.id, head, si, [r2(sPos.x), r2(sPos.z)]);
        else sendRel(target.peer, { t: 'pd', a: r2(d), by: shooter.id, h: head ? 1 : 0, s: si, f: [r2(sPos.x), r2(sPos.z)] });
    }
}
function netPvpDamaged(d, by, head, si, f) {
    if (!NET.inGame || NET.dead || NET.spec || NET.lockT > 0) return;
    NET.lastBy = by; NET.lastSrc = si;
    const k = playerById(by);
    takeDamage(d, f ? new V3(f[0], 0, f[1]) : null, k ? k.name : undefined);
    if (head) sfx('head');
}


// ---------- dying, respawning, spectating ----------
function netLocalDeath() {
    if (NET.dead) return;
    NET.dead = true; currentHp = 0; NET.me.alive = false;
    if (vmModel) vmModel.root.visible = false;
    cancelReload(); isMouseDown = false;
    const by = NET.pvp ? NET.lastBy : -1;
    if (NET.host) hostOnDeath(NET.id, by, NET.lastSrc); else sendRel(NET.hostPeer, { t: 'dead', by, s: NET.lastSrc });
    if (NET.pvp) NET.respawnT = 3;
    screenFlash('rgba(0,0,0,0.6)');
    netHudDown();
    updateHUD();
}
function hostOnDeath(victim, by, si) {
    const v = playerById(victim); if (!v || !NET.inGame) return;
    v.alive = false; if (v.tgt) v.tgt.alive = false;
    v.deaths++;
    const k = playerById(by);
    if (NET.mode === 'tourney') {
        const m = { t: 'feed', k: by !== victim ? by : -1, v: victim, s: si || 0 }; netBroadcast(m); netOnFeed(m);
        tourneyOnDeath(victim, by); return;
    }
    if (NET.pvp) {
        if (k && by !== victim) { k.kills++; NET.score[k.team]++; }
        const m = { t: 'feed', k: k && by !== victim ? by : -1, v: victim, s: si || 0 };
        netBroadcast(m); netOnFeed(m);
        hostSendScore();
        const win = NET.score[0] >= NET.target ? 0 : NET.score[1] >= NET.target ? 1 : -1;
        if (win >= 0 && !NET.over) { NET.over = true; const e = { t: 'end', win, score: NET.score }; setTimeout(() => { netBroadcast(e); netShowEnd(e); }, 1200); }
    } else {
        const m = { t: 'feed', k: -2, v: victim, s: 0 };
        netBroadcast(m); netOnFeed(m);
    }
}
function hostSendScore() {
    const m = { t: 'score', s: NET.score, k: allPlayers().map(p => [p.id, p.kills, p.deaths]) };
    netBroadcast(m); netOnScore(m);
}
function netOnScore(m) {
    NET.score = m.s;
    for (const [id, k, d] of m.k) { const p = playerById(id); if (p) { p.kills = k; p.deaths = d; } }
}
function netOnFeed(m) {
    const v = playerById(m.v), k = playerById(m.k);
    const nm = (p) => p ? `<span style="color:${hex(pcol(p))}">${escHtml(p.id === NET.id ? 'YOU' : p.name)}</span>` : '?';
    if (m.k === -2) netFeed(`${nm(v)} <span class="text-red-300">is down!</span>`);
    else if (k) netFeed(`${nm(k)} <span class="text-gray-300">[${escHtml(killerName(NET_SRC[m.s] || 'explosive'))}]</span> ${nm(v)}`);
    else netFeed(`${nm(v)} <span class="text-gray-300">died</span>`);
    // their body bursts
    if (v && v.av && v.id !== NET.id) { const P = v.av.g.position; spawnParticles(new V3(P.x, P.y + 1, P.z), NET.pvp ? TEAM_COLORS[v.team] : v.color, 12, 8, 1.1, 0.3, true, { bounce: true, spin: 12, grav: 26, jitterY: 0.8, up: 1.3 }); }
    if (m.k === NET.id && m.v !== NET.id) { gainXP(25); toast(`YOU ELIMINATED ${v ? v.name.toUpperCase() : 'SOMEONE'}`, '#fca5a5', 1.6); sfx('headkill'); runStats.kills++; }
    if (v && v !== NET.me) v.alive = false;
}
function netFeed(html) {
    NET.feed.push({ html, t: performance.now() });
    if (NET.feed.length > 5) NET.feed.shift();
    NET.feedDirty = true;
}
function netReviveIfDown() {
    if (!NET.dead || NET.pvp) return;
    // back in the fight next to a teammate who's still standing
    let at = null;
    for (const p of netPlayers.values()) if (p.alive && p.av) { at = p.av.g.position; break; }
    netRespawn(at ? [at.x + 1.5, at.z + 1.5] : spawnPt, 60, at ? at.y : 0);
    toast("YOU'RE BACK IN!", '#4ade80', 1.8);
}
function netRespawn(xz, hp, feet = 0) {
    NET.dead = false; NET.me.alive = true; currentHp = hp;
    if (xz.length > 2 && !feet) feet = xz[2];
    // land on whatever is at that height (ground by default), not the top of a crane above it
    camera.position.set(xz[0], EYE_STAND, xz[1]); feetY = groundAt(xz[0], xz[1], 0.3, feet + 0.5);
    // Sky Islands: never respawn over thin air or inside a block (that was the die-again-straight-away / can't-move bug)
    if (VOID && (feetY < feet - 3 || pointInSolid(new V3(xz[0], feetY + 1, xz[1]), 0.4))) { const s = nearestSafe(xz[0], xz[1]); if (s) { camera.position.x = s[0]; camera.position.z = s[2]; feetY = s[1]; } }
    camera.position.y = feetY + EYE_STAND;
    velocity.set(0, 0, 0); push.set(0, 0, 0);
    if (vmModel) vmModel.root.visible = true;
    ui.netDown.classList.add('hidden');
    updateHUD();
}
// the closest checked-safe standing spot (Sky Islands)
function nearestSafe(x, z) {
    if (!nav || !nav.Y.length) return null;
    if (safeFor !== nav) buildSafeSpots();
    let best = null, bd = 1e9;
    for (const s of safeSpots) { const d = (s[0] - x) ** 2 + (s[2] - z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
}
function netPvpRespawn() {
    const list = NET.spawns[NET.team] || [];
    const s = list.length ? list[Math.floor(Math.random() * list.length)] : [0, 0];
    resetAmmo(); secondaryCooldown = 0; cancelReload();
    netRespawn(s, maxHp);
    NET.lastBy = -1;
    camera.quaternion.setFromEuler(new THREE.Euler(0, NET.team ? 0 : Math.PI, 0, 'YXZ'));
}
const _spec = new V3();
function netSpectate(dt) {
    if (NET.pvp) return;       // PvP: short death cam, you respawn in 3s
    let t = null;
    for (const p of netPlayers.values()) if (p.alive && p.av && p.av.g.visible) { t = p; break; }
    if (!t) return;
    const P = t.av.g.position, yaw = t.cur[4];
    _spec.set(P.x + Math.sin(yaw) * 4.5, P.y + 3.2, P.z + Math.cos(yaw) * 4.5);
    camera.position.lerp(_spec, 1 - Math.exp(-6 * dt));
    camera.lookAt(P.x, P.y + 1.6, P.z);
    ui.netDown.innerHTML = `<div class="text-4xl font-black text-red-400">YOU'RE DOWN</div><div class="text-lg font-bold text-gray-200">Watching <span style="color:${hex(t.color)}">${escHtml(t.name)}</span> - you'll be back next wave</div>`;
}


// (5.2: the player models, name tags and their animation moved to 27b-mp-look.js)


// ---------- starting a match ----------
function hostStartGame() {
    const L = NET.lobby, mode = L.mode;
    const err = startProblem(); if (err) { NET.hostMsg = err; renderMP(); return; }
    const maps = MAP_IDS();
    const tz = mode === 'tourney';
    const map = tz ? 'tourney' : L.map === 'random' ? maps[Math.floor(Math.random() * maps.length)] : L.map;
    const themeIds = Object.keys(THEMES);
    const cfg = { t: 'start', seed: Math.floor(Math.random() * 1e9), map, theme: tz ? (Math.random() < 0.5 ? 'day' : 'sunset') : themeIds[Math.floor(Math.random() * themeIds.length)], mode, diff: L.diff,
                  players: allPlayers().map(p => ({ id: p.id, name: p.name, team: p.team, color: p.color, look: lookOf(p) || null })) };
    for (const p of netPlayers.values()) p.pending = false;
    NET.cfg = cfg;
    netBroadcast(cfg);
    netBeginGame(cfg);
    if (tz) tourneyHostStart(cfg);
}
function hostLateJoin(p) {
    if (!NET.cfg) return;
    autoTeam(p);
    p.kills = 0; p.deaths = 0; p.buf.clear(); p.tgt.feet = -100; p.tgt.alive = false;
    const players = allPlayers().map(q => ({ id: q.id, name: q.name, team: q.team, color: q.color, look: lookOf(q) || null }));
    sendRel(p.peer, Object.assign({}, NET.cfg, { players, late: { level: playerStats.level, wave: waveActive, inter: intermission, score: NET.score, kd: allPlayers().map(q => [q.id, q.kills, q.deaths]) } }));
    if (NET.mode === 'tourney') { p.spec = true; if (TN.on) { TN.names[p.id] = p.name; sendRel(p.peer, tourneySnapshot(Math.max(0, (TN.until - performance.now()) / 1000), TN.phase, TN.phaseId)); } }
    netBroadcast({ t: 'pj', id: p.id, name: p.name, team: p.team, color: p.color, look: p.look || null }, p.id);
    if (!p.av) { p.av = makeAvatar(p); p.av.g.position.set(spawnPt[0], -50, spawnPt[1]); }
    netFeed(`<span style="color:${hex(NET.pvp ? TEAM_COLORS[p.team] : p.color)}">${escHtml(p.name)}</span> joined the match`);
}
// a guest who joined mid-match catches up with the wave / score
function netApplyLate(L) {
    if (!NET.pvp) {
        playerStats.level = L.level; waveActive = !!L.wave; intermission = L.inter || 0;
        playerStats.money += 150 * Math.max(0, L.level - 1);          // catch-up cash so you're not stuck with a pistol on wave 12
        if (waveActive) scheduleSupply();
    } else NET.score = L.score || [0, 0];
    for (const [id, k, d] of L.kd || []) { const q = playerById(id); if (q) { q.kills = k; q.deaths = d; } }
    toast('Joined a match in progress!', '#c4b5fd', 2.2);
    updateHUD();
}
function startProblem() {
    const mode = NET.lobby.mode, all = allPlayers();
    if (mode === 'coop') return all.length > 10 ? 'Co-op is capped at 10 players.' : '';
    if (mode === 'tourney') return all.length < 4 ? `A tournament needs 4 to 8 players (you have ${all.length}).` : all.length > 8 ? 'A tournament is limited to 8 players.' : '';
    const size = MP_MODES[mode].team, n = [0, 0];
    for (const p of all) n[p.team]++;
    if (all.length < 2) return 'You need at least one other player for ' + MP_MODES[mode].name + '.';
    if (n[0] > size || n[1] > size) return `Too many on one team for ${MP_MODES[mode].name} (max ${size} each). Click a player to move them.`;
    if (!n[0] || !n[1]) return 'Both teams need at least one player. Click a player to move them.';
    return '';
}
function netBeginGame(cfg) {
    NET.inGame = true; NET.mode = cfg.mode; NET.pvp = cfg.mode !== 'coop'; NET.dead = false; NET.over = false;
    NET.score = [0, 0]; NET.target = PVP_TARGET[cfg.mode] || 0; NET.feed = []; NET.feedDirty = true; NET.slowT = 0;
    // everybody in the match
    for (const q of cfg.players) {
        if (q.id === NET.id) { NET.team = q.team; NET.color = q.color; continue; }
        let p = netPlayers.get(q.id);
        if (!p) { p = makePlayer(q.id, q.name, q.team, q.color); netPlayers.set(q.id, p); }
        Object.assign(p, { name: q.name, team: q.team, color: q.color, kills: 0, deaths: 0, alive: true, f: 1, fireT: 0 }); if (q.look) p.look = cleanLook(q.look);
        p.buf.clear(); p.tgt.feet = -100; p.tgt.alive = false;
    }
    NET.me = { id: NET.id, name: NET.name, team: NET.team, color: NET.color || COOP_COLORS[0], kills: 0, deaths: 0, alive: true, rtt: 0 };
    // a fresh run on the same map as everyone else
    resetRun(); needsNewWorld = false;
    run = { mode: 'classic', map: cfg.map, diff: cfg.diff || 'normal' };
    runStats = freshRunStats(); runXP = 0; runUnlocks = [];
    netEnemySeq = 0; enemyById.clear(); NET.deadIds.clear();
    applyTheme(cfg.theme); buildWorld(cfg.map, cfg.seed);
    for (const p of netPlayers.values()) { if (p.av) scene.remove(p.av.g); p.av = makeAvatar(p); p.av.g.position.set(spawnPt[0], -50, spawnPt[1]); }
    if (NET.pvp) {
        playerStats.weapons = WEAPON_ORDER.slice(); playerStats.currentWeapon = 'ar';
        playerStats.secondaries = ['grenade']; playerStats.currentSecondary = 'grenade';
        resetAmmo();
        if (cfg.mode === 'tourney') { NET.spawns = [[TOURNEY.spawns[0]], [TOURNEY.spawns[1]]]; tourneyInit(cfg); for (const p of netPlayers.values()) p.spec = true; tourneyGoSeat(); }
        else { pickTeamSpawns(cfg.seed); netPvpRespawn(); }
    } else {
        const order = cfg.players.findIndex(q => q.id === NET.id), a = order / Math.max(1, cfg.players.length) * Math.PI * 2;
        netRespawn([spawnPt[0] + Math.cos(a) * (order ? 2.5 : 0), spawnPt[1] + Math.sin(a) * (order ? 2.5 : 0)], maxHp);
        camera.quaternion.identity();
        intermission = 6; playerStats.level = 1;
    }
    hideMP();
    netHud(true);
    changeGameState('playing');
    if (NET.host) startHiddenTicker();
    toast(cfg.mode === 'tourney' ? 'TOURNAMENT - win your duels to become champion' : NET.pvp ? `${MP_MODES[cfg.mode].name} TEAM DEATHMATCH - first team to ${NET.target} wins` : 'CO-OP - first wave in a few seconds', '#c4b5fd', 3);
}
function pickTeamSpawns(seed) {
    const rnd = mulberry32(seed + 7);
    NET.spawns = [[], []];
    if (VOID) {       // Sky Islands: random x/z is thin air, so spawn only on the checked-safe cloud spots, one end per team
        if (safeFor !== nav) buildSafeSpots();
        for (let team = 0; team < 2; team++) {
            const side = team ? 1 : -1, mine = safeSpots.filter(s => s[2] * side > 4).sort((a, b) => b[2] * side - a[2] * side);
            const pick = mine.length ? mine : safeSpots.slice();
            for (let i = 0; i < 8 && pick.length; i++) { const s = pick[Math.floor(i * pick.length / 8 * 0.5)]; NET.spawns[team].push([s[0], s[2], s[1]]); }
            if (!NET.spawns[team].length) NET.spawns[team].push([spawnPt[0], spawnPt[1], 0]);
        }
        return;
    }
    for (let team = 0; team < 2; team++) {
        const zc = (team ? 1 : -1) * ARENA * 0.7;
        for (let tries = 0; tries < 600 && NET.spawns[team].length < 8; tries++) {
            const x = (rnd() * 2 - 1) * ARENA * 0.5, z = zc + (rnd() * 2 - 1) * ARENA * 0.18;
            const n = navNodeAt(x, z, 0.2);
            if (n < 0 || nav.Y[n] > 0.1 || nav.ceil[n] < 5 || pointInSolid(new V3(x, 1, z), 1.2)) continue;
            NET.spawns[team].push([x, z]);
        }
        if (!NET.spawns[team].length) NET.spawns[team].push([0, zc * 0.8]);
    }
}
function netShowEnd(m) {
    if (!NET.inGame) return;
    NET.inGame = false; NET.over = true; if (TN.on) { tourneyReset(); }
    commitLife();
    const h = document.querySelector('#gameover-overlay h2'), sub = document.querySelector('#gameover-overlay p');
    let title, line;
    if (m.t === 'tend') {
        title = 'CHAMPION'; line = `${tnName(m.champ)} wins the tournament`;
    } else if (m.t === 'end') {
        const won = m.win === NET.team;
        title = won ? 'VICTORY' : 'DEFEAT'; line = `${TEAM_NAMES[m.win]} TEAM WINS  ${m.score[0]} - ${m.score[1]}`;
    } else { title = 'SQUAD WIPED'; line = `Your squad made it to wave ${playerStats.level}`; }
    h.textContent = title; sub.textContent = line;
    $('gameover-stats').textContent = 'Back to the party lobby in a few seconds...';
    $('gameover-grid').innerHTML = allPlayers().sort((a, b) => b.kills - a.kills).map(p => `<div class="stat"><div class="v" style="color:${hex(NET.pvp ? TEAM_COLORS[p.team] : p.color)}">${escHtml(p.name)}</div><div class="k">${NET.pvp ? `${p.kills} KILLS - ${p.deaths} DEATHS` : `${p.deaths} TIMES DOWNED`}</div></div>`).join('');
    $('gameover-xp').innerHTML = `<div class="text-green-300 font-black">+${runXP} XP</div>`;
    ui.btnRespawn.classList.add('hidden'); $('btn-go-continue').classList.add('hidden'); $('btn-go-menu').textContent = 'LEAVE PARTY';
    changeGameState('gameover');
    setTimeout(() => { if (NET.on && !NET.inGame) netBackToLobby(); }, 7000);
}
function netBackToLobby() {
    tourneyReset();
    for (const p of netPlayers.values()) { if (p.av) scene.remove(p.av.g); p.av = null; p.tgt.alive = false; p.tgt.feet = -100; }
    h2Reset();
    resetRun();
    // the host stays in its own party: clearing this used to drop the host from the lobby list and the next match's
    // players, so guests had no avatar for it (an invisible host that could still shoot them)
    NET.dead = false; NET.pvp = false; NET.me = NET.host ? hostMe() : null;
    netHud(false);
    if (!NET.host) stopHiddenTicker();          // the host keeps it: it pings the lobby while its tab is hidden
    changeGameState('main');
    openMP(NET.host ? 'host' : 'join');
}
function h2Reset() {
    document.querySelector('#gameover-overlay h2').textContent = 'WASTED';
    document.querySelector('#gameover-overlay p').textContent = 'ALL PROGRESS LOST';
    ui.btnRespawn.classList.remove('hidden'); ui.btnRespawn.textContent = 'START OVER'; $('btn-go-continue').classList.add('hidden'); $('btn-go-menu').textContent = 'MAIN MENU';
}


// ---------- the per-frame network work ----------
const _eul = new THREE.Euler(0, 0, 0, 'YXZ');
function netTick(dt) {
    if (!NET.on) return;
    const now = performance.now(), gap = now - (NET.tickAt || now);
    NET.tickAt = now;
    // only judge the link on a normal frame: right after this page was frozen (hidden tab, loading a map)
    // the messages that queued up meanwhile haven't been read yet
    if (gap < 1500) {
        if (NET.host) {
            for (const p of [...netPlayers.values()]) if (p.peer && p.peer.lastMsg && now - p.peer.lastMsg > 15000) netRemovePlayer(p.id, 'lost connection');
        } else if (NET.hostPeer && NET.joinState === 'connected' && NET.hostPeer.lastMsg && now - NET.hostPeer.lastMsg > 12000) {
            netHostGone('Lost connection to the host. Type the code again to rejoin.'); return;
        }
    }
    netKeepAlive(now);
    if (NET.inGame) {
        netUpdateAvatars(dt);
        if (TN.on) tourneyTick(dt);
        if (NET.fireT > 0) NET.fireT -= dt;
        if (NET.pvp && NET.dead && NET.mode === 'tourney') {
            ui.netDown.innerHTML = `<div class="text-4xl font-black text-red-400">ELIMINATED</div><div class="text-lg font-bold text-gray-200">Watch the rest of the tournament from the stands</div>`;
        } else if (NET.pvp && NET.dead) {
            NET.respawnT -= dt;
            const k = playerById(NET.lastBy);
            ui.netDown.innerHTML = `<div class="text-4xl font-black text-red-400">ELIMINATED</div><div class="text-lg font-bold text-gray-200">${k && k.id !== NET.id ? 'by <span style="color:' + hex(TEAM_COLORS[k.team]) + '">' + escHtml(k.name) + '</span> - ' : ''}back in ${Math.max(0, Math.ceil(NET.respawnT))}</div>`;
            if (NET.respawnT <= 0) netPvpRespawn();
        }
        // hits happen every frame; send them right away so the host hears about them fast
        if (NET.hitOut.length) { sendRel(NET.hostPeer, { t: 'h', l: NET.hitOut.splice(0) }); }
        if (NET.pvpOut.size) {
            const l = [...NET.pvpOut.entries()].map(([pid, v]) => [pid, r2(v[0]), v[1] ? 1 : 0, v[2] ? 1 : 0, v[3]]);
            NET.pvpOut.clear();
            if (NET.host) hostApplyPvpHits(NET.me, l); else sendRel(NET.hostPeer, { t: 'ph', l });
        }
        // co-op: everyone down = game over
        if (NET.host && !NET.pvp && !NET.over && NET.dead && [...netPlayers.values()].every(p => !p.tgt.alive)) {
            NET.over = true; const m = { t: 'over', n: playerStats.level };
            setTimeout(() => { netBroadcast(m); netShowEnd(m); }, 1500);
        }
        if ((NET.hudT -= dt) <= 0) { NET.hudT = 0.2; netHudUpdate(); }
    }
    // player updates 30x a second (20x in big parties), enemy updates 20x a second
    const pTick = netPlayers.size >= 5 ? 1 / 20 : 1 / 30;
    NET.sendAcc += dt; NET.enemyAcc = (NET.enemyAcc || 0) + dt;
    if (NET.inGame && NET.host && !NET.pvp && NET.enemyAcc >= 1 / 20) { NET.enemyAcc = Math.min(NET.enemyAcc - 1 / 20, 1 / 20); hostEnemySnapshot(now); }
    if (NET.sendAcc >= pTick) {
        NET.sendAcc = Math.min(NET.sendAcc - pTick, pTick);
        if (NET.inGame) { if (NET.host) hostSend(now); else clientSend(now); }
    }
}
// host -> everyone every 2 seconds of REAL time (it used to count frames, so a slow or hidden host tab went
// quiet and guests dropped out of the lobby ~12s after joining). Also runs from the background ticker.
function netKeepAlive(now) {
    if (!NET.on || !NET.host || now - NET.pingAt < 2000) return;
    NET.pingAt = now;
    for (const p of netPlayers.values()) sendRel(p.peer, { t: 'pi', ts: now });
    netBroadcast({ t: 'rt', l: [...netPlayers.values()].map(p => [p.id, Math.round(p.rtt)]) });
    // the launcher lists an open party (same Wi-Fi, or everyone): every 30 s while there is room
    if (now - (NET.partyAt || 0) > 30000) { NET.partyAt = now; try { const lp = window.parent; if (lp && lp !== window && lp.HG_partyOpen && /^\d{6}$/.test(NET.code || '') && allPlayers().length < 10)
      lp.HG_partyOpen({ game: 'blocky', code: NET.code, n: allPlayers().length, max: 10, mode: (MP_MODES[NET.lobby.mode] || {}).name || NET.lobby.mode }); } catch (e) {} }
    if (!NET.inGame && !document.hidden) renderMPPlayers();
}
function myState() {
    _eul.setFromQuaternion(camera.quaternion);
    const alive = currentHp > 0 && !NET.dead && !NET.spec;
    const f = (alive ? 1 : 0) | (aimHeld ? 2 : 0) | (NET.fireT > 0 ? 4 : 0) | (slideT > 0 ? 8 : 0) | (isReloading ? 16 : 0) | (currentGameState !== 'playing' ? 32 : 0);
    return { p: [r2(camera.position.x), r2(camera.position.y), r2(camera.position.z), r2(feetY), r3(_eul.y), r3(_eul.x)], w: Math.max(0, WEAPON_ORDER.indexOf(playerStats.currentWeapon)), f, hp: Math.max(0, Math.ceil(currentHp)) };
}
function clientSend(now) {
    const s = myState();
    s.t = 'S'; s.ct = now;
    if (NET.myShots.length) s.s = NET.myShots.splice(0);
    sendFast(NET.hostPeer, JSON.stringify(s));
}
function hostSend(now) {
    const me = myState();
    const pl = [[NET.id, ...me.p, me.w, me.f, me.hp]];
    for (const p of netPlayers.values()) if (p.last) pl.push([p.id, ...p.last, p.w, p.f, p.hp]);
    for (const s of NET.myShots) NET.shotOut.push([NET.id, ...s]);
    NET.myShots.length = 0;
    const msg = JSON.stringify({ t: 'P', ht: now, p: pl, s: NET.shotOut.length ? NET.shotOut.splice(0) : undefined });
    for (const p of netPlayers.values()) sendFast(p.peer, msg);
}


// ---------- keep the host ticking if its window is hidden ----------
// (browsers pause hidden tabs; a tiny worker keeps the referee running for everyone else)
let hiddenWorker = null, hiddenTimer = 0;
function startHiddenTicker() {
    if (hiddenWorker || hiddenTimer) return;
    // in a match: run the whole game; in the party lobby: just keep pinging so guests stay connected
    const tick = () => { if (!document.hidden || !NET.host) return; if (NET.inGame) frame(performance.now()); else netKeepAlive(performance.now()); };
    try {
        hiddenWorker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33);'], { type: 'text/javascript' })));
        hiddenWorker.onmessage = tick;
    } catch (e) { hiddenTimer = setInterval(tick, 33); }
}
function stopHiddenTicker() { if (hiddenWorker) { hiddenWorker.terminate(); hiddenWorker = null; } if (hiddenTimer) { clearInterval(hiddenTimer); hiddenTimer = 0; } }
