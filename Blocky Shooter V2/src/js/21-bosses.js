// ---------- 3.9 BOSSES: shared attack pieces ----------
// Warning circles that fill up and then go off, burning pools, shockwaves you have to JUMP over and boss
// projectiles. The host (or single player) does the damage; co-op guests get the same effects as a show ('bfx').
let bossFx = [];
const _bRingGeo = new THREE.RingGeometry(0.9, 1, 48); _bRingGeo.rotateX(-Math.PI / 2);
const _bWaveGeo = new THREE.CylinderGeometry(1, 1, 1, 56, 1, true); _bWaveGeo.translate(0, 0.5, 0);
const _bShotGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const bossAuth = () => !NET.inGame || NET.host;
const fxMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
function bossNet(m) { if (NET.inGame && NET.host) netBroadcast(Object.assign({ t: 'bfx' }, m)); }
const r2a = (v) => [r2(v.x), r2(v.y), r2(v.z)];
// velocity to lob something from 'from' to (tx, ty, tz) in T seconds under gravity g
function lobVel(from, tx, ty, tz, T, g) { return new V3((tx - from.x) / T, (ty - from.y + 0.5 * g * T * T) / T, (tz - from.z) / T); }
// a ground warning circle: fills up over t seconds, then act() goes off (host only)
function bossTele(x, y, z, r, t, color, act, net = true) {
    const ring = new THREE.Mesh(_bRingGeo, fxMat(color, 0.85)); ring.position.set(x, y + 0.08, z); ring.scale.setScalar(r);
    const disc = new THREE.Mesh(_fireGeo, fxMat(color, 0.3)); disc.position.set(x, y + 0.06, z); disc.scale.setScalar(0.01);
    scene.add(ring, disc);
    bossFx.push({ k: 'tele', ring, disc, x, y, z, r, t, T: t, act: bossAuth() ? act : null });
    if (net) bossNet({ k: 'tele', p: [r2(x), r2(y), r2(z)], r: r2(r), d: r2(t), c: color });
    if (Math.hypot(camera.position.x - x, camera.position.z - z) < r + 3) sfx('warn');
}
// a pool of fire / acid on the ground that hurts players standing in it
function bossHazard(x, y, z, r, dps, t, color, by, net = true) {
    const m = new THREE.Mesh(_fireGeo, fxMat(color, 0.5)); m.position.set(x, y + 0.05 + Math.random() * 0.02, z); m.scale.setScalar(r);
    scene.add(m);
    bossFx.push({ k: 'haz', m, x, y, z, r, dps, t, T: t, color, by, tick: 0.3 });
    if (net) bossNet({ k: 'haz', p: [r2(x), r2(y), r2(z)], r: r2(r), d: r2(t), c: color });
}
// an expanding ring along the ground: anyone standing on the ground when it passes gets hit - jump over it!
function bossWave(x, y, z, maxR, speed, dmg, color, by, net = true) {
    const m = new THREE.Mesh(_bWaveGeo, fxMat(color, 0.75)); m.position.set(x, y, z); m.scale.set(0.5, 0.9, 0.5);
    scene.add(m);
    bossFx.push({ k: 'wave', m, x, y, z, R: 0.5, maxR, speed, dmg, color, by, hit: new Set() });
    if (net) bossNet({ k: 'wave', p: [r2(x), r2(y), r2(z)], r: r2(maxR), sp: speed, c: color });
}
// an explosion that only hurts players (fire = leave a burning pool behind)
function bossBlast(p, r, dmg, color, by, fire, inner = 0) {
    explode(p, 0, r, { fxOnly: true, color });
    if (NET.inGame) netSendFx('boom', p, r, color);
    for (const t of aiTargets()) {
        if (!t.alive) continue;
        const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
        if (d >= r + 0.4 || d < inner || Math.abs(t.feet - p.y) > Math.max(2.5, r * 0.6)) continue;
        const k = 7 / (d || 1);
        hurtTarget(t, dmg * (1 - 0.45 * Math.min(1, d / r)), p, [(t.pos.x - p.x) * k, 6, (t.pos.z - p.z) * k], by);
    }
    if (fire) bossHazard(p.x, groundAt(p.x, p.z, 0, p.y + 0.5), p.z, fire.r, fire.dps, fire.t, fire.c, by);
}
// a boss projectile. o: { c colour, s size, g gravity, life, dmg, r hit radius, boom blast radius, fire pool, home turn rate, tg target id, by, lit }
function bossShot(from, vel, o, net = true) {
    const mat = o.lit ? new THREE.MeshLambertMaterial({ color: o.c }) : new THREE.MeshBasicMaterial({ color: o.c, toneMapped: false });
    const mesh = new THREE.Mesh(_bShotGeo, mat); mesh.scale.setScalar(o.s || 1); mesh.position.copy(from);
    scene.add(mesh);
    projectiles.push({ kind: 'bshot', mesh, vel: vel.clone(), o, life: o.life || 4, from: from.clone(), fxOnly: !net });
    if (net) bossNet({ k: 'shot', p: r2a(from), v: r2a(vel), o: { c: o.c, s: o.s, g: o.g, life: o.life, home: o.home, tg: o.tg, lit: o.lit, boom: o.boom } });
}
function bossTargetPos(id) {
    if (id === undefined || id === NET.id || !NET.inGame) return camera.position;
    if (NET.host) { for (const t of aiTargets()) if (t.id === id) return t.pos; return null; }
    const p = netPlayers.get(id); return p && p.av ? p.av.g.position.clone().setY(p.av.g.position.y + 1.4) : null;
}
function stepBossShot(p, dt) {
    const o = p.o, q = p.mesh.position;
    p.life -= dt;
    if (o.home) {
        const tp = bossTargetPos(o.tg);
        if (tp) { _tmp.set(tp.x - q.x, tp.y - 0.5 - q.y, tp.z - q.z).normalize().multiplyScalar(p.vel.length()); p.vel.lerp(_tmp, Math.min(1, o.home * dt)); }
    }
    if (o.g) p.vel.y -= o.g * dt;
    q.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 5; p.mesh.rotation.y += dt * 3;
    if (Math.random() < 0.6) spawnParticles(q, o.c, 1, 0.8, 0.35, 0.12 * (o.s || 1), !!o.lit, { grav: o.lit ? 3 : -1 });
    let hitT = null;
    const hr = 0.45 + 0.25 * (o.s || 1);
    if (!p.fxOnly) for (const t of aiTargets()) if (t.alive && Math.abs(q.y - (t.feet + 0.9)) < 0.9 + hr && Math.hypot(q.x - t.pos.x, q.z - t.pos.z) < 0.35 + hr) { hitT = t; break; }
    const gy = groundAt(q.x, q.z, 0, q.y + 0.3), ground = q.y <= gy + 0.1;
    if (!(hitT || ground || p.life <= 0 || pointInSolid(q, 0.05))) return;
    removeProjectile(p); p.mesh.material.dispose();
    spawnParticles(q, o.c, 8, 5, 0.4, 0.14 * (o.s || 1), !!o.lit);
    if (p.fxOnly) return;
    if (o.boom) bossBlast(q.clone(), o.boom, o.dmg, o.c, o.by, o.fire);
    else {
        if (hitT) hurtTarget(hitT, o.dmg, p.from, null, o.by);
        if (o.fire && (ground || hitT)) bossHazard(q.x, groundAt(q.x, q.z, 0, q.y + 0.5), q.z, o.fire.r, o.fire.dps, o.fire.t, o.fire.c, o.by);
    }
}
function updateBossFx(dt) {
    if (!bossFx.length) return;
    const auth = bossAuth(), T = auth ? aiTargets() : null;
    for (let i = bossFx.length - 1; i >= 0; i--) {
        const f = bossFx[i];
        let done = false;
        if (f.k === 'tele') {
            f.t -= dt;
            const k = 1 - Math.max(0, f.t) / f.T;
            f.disc.scale.setScalar(Math.max(0.01, f.r * k));
            f.ring.material.opacity = f.t < 0.35 ? (Math.floor(f.t * 20) % 2 ? 1 : 0.4) : 0.85;
            if (f.t <= 0) { done = true; if (f.act) f.act(); }
        } else if (f.k === 'haz') {
            f.t -= dt; f.tick -= dt;
            f.m.material.opacity = (0.32 + 0.14 * Math.sin(gameTime * 9 + i)) * Math.min(1, f.t);
            if (Math.random() < 0.5) spawnParticles(new V3(f.x + (Math.random() - 0.5) * f.r * 1.4, f.y + 0.2, f.z + (Math.random() - 0.5) * f.r * 1.4), f.color, 1, 2, 0.6, 0.18, false, { grav: -5 });
            if (auth && f.tick <= 0) {
                f.tick = 0.3;
                for (const t of T) if (t.alive && Math.hypot(t.pos.x - f.x, t.pos.z - f.z) < f.r && Math.abs(t.feet - f.y) < 1.4) hurtTarget(t, f.dps * 0.3, null, null, f.by);
            }
            done = f.t <= 0;
        } else if (f.k === 'wave') {
            f.R += f.speed * dt;
            f.m.scale.set(f.R, 0.9, f.R);
            f.m.material.opacity = 0.75 * Math.min(1, (f.maxR - f.R) / 4);
            if (auth) for (const t of T) {
                if (!t.alive || f.hit.has(t.id)) continue;
                const d = Math.hypot(t.pos.x - f.x, t.pos.z - f.z);
                if (Math.abs(d - f.R) < 0.9 && t.feet - f.y < 0.75 && t.feet - f.y > -2) {
                    f.hit.add(t.id); const k = 7 / (d || 1);
                    hurtTarget(t, f.dmg, new V3(f.x, f.y, f.z), [(t.pos.x - f.x) * k, 7, (t.pos.z - f.z) * k], f.by);
                }
            }
            done = f.R >= f.maxR;
        }
        if (done) { for (const m of [f.ring, f.disc, f.m]) if (m) { scene.remove(m); m.material.dispose(); } bossFx.splice(i, 1); }
    }
}
function clearBossFx() { for (const f of bossFx) for (const m of [f.ring, f.disc, f.m]) if (m) { scene.remove(m); m.material.dispose(); } bossFx = []; }
function netBossFx(m) {
    const p = m.p || [0, 0, 0];
    if (m.k === 'tele') bossTele(p[0], p[1], p[2], m.r, m.d, m.c, null, false);
    else if (m.k === 'haz') bossHazard(p[0], p[1], p[2], m.r, 0, m.d, m.c, '', false);
    else if (m.k === 'wave') bossWave(p[0], p[1], p[2], m.r, m.sp, 0, m.c, '', false);
    else if (m.k === 'shot' && m.o) bossShot(new V3(p[0], p[1], p[2]), new V3(m.v[0], m.v[1], m.v[2]), m.o, false);
    else if (m.k === 'rage') toast(`${String(m.n).slice(0, 30).toUpperCase()} IS ENRAGED!`, m.c || '#f87171', 2.2);
}
// a spot near (cx, cz) between minD and maxD away that's on the map: [x, y, z]
function bossSpot(cx, cz, minD, maxD, y0 = 50) {
    if (VOID) return navSpot(cx, cz, minD, maxD) || navSpot(cx, cz, 0, maxD + 20);
    for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2, r = minD + Math.random() * (maxD - minD);
        const x = clamp(cx + Math.cos(a) * r, -ARENA + 6, ARENA - 6), z = clamp(cz + Math.sin(a) * r, -ARENA + 6, ARENA - 6);
        if (inCage(x, z)) continue;
        return [x, groundAt(x, z, 0, y0), z];
    }
    return [cx, groundAt(cx, cz, 0, y0), cz];
}
function bossMinion(id, cx, cz, cy, minD, maxD) {
    const sp = bossSpot(cx, cz, minD, maxD, cy + 4);
    if (!sp) return null;
    const e = spawnEnemy(enemyTypes[id], sp[0], sp[2], sp[1] + 0.2, waveSpeed(playerStats.level), waveReward(playerStats.level));
    e.userData.dropping = false;
    if (id === 'crawler') crawlerWake(e, 0, 0);
    spawnParticles(new V3(sp[0], sp[1] + 1, sp[2]), enemyTypes[id].eye || 0xffffff, 10, 5, 0.6, 0.15);
    return e;
}
// 5.0 vent crawlers: they start hidden; this pops one out of its vent and into a pounce
function crawlerWake(e, dx, dz) {
    const u = e.userData; if (!u.hidden && u.state === 'pounce') return;
    u.hidden = false; e.visible = true; u.barShow = true;
    if (dx || dz) u.cdir.set(dx, 0, dz); else u.cdir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    u.state = 'pounce'; u.stateT = 0.5; u.velocityY = 5; u.onGround = false;
    spawnParticles(new V3(e.position.x, e.position.y + 0.3, e.position.z), 0x9ca3af, 10, 5, 0.6, 0.15, true, { grav: 6 });
    sfxAt('thud', Math.hypot(camera.position.x - e.position.x, camera.position.z - e.position.z));
}
function bossHpMul(cfg) {
    if (!cfg.boss) return 1;
    const L = playerStats.level;
    return run.mode === 'bossrush' ? 0.45 + L * 0.17 : Math.max(1, L / 5);
}
// Which bosses come on this wave. The 7 newer bosses come in a random order that's fixed for the run
// (from the run's seed, so a saved run meets the same bosses), after the Abomination opens on wave 5.
function bossOrder() {
    const ids = BOSS_IDS.filter(k => k !== 'boss' && !enemyTypes[k].campOnly);
    let x = (run.seed || 777) >>> 0;
    const rnd = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ['boss', ...ids];
}
function waveBosses(level) {
    const order = bossOrder(), n = order.length;
    if (run.mode === 'bossrush') { const out = [order[(level - 1) % n]]; if (level > n) out.push(order[(level + 2) % n]); return out; }
    if (level % 5) return [];
    const i = level / 5 - 1, out = [order[i % n]];
    if (level >= 25) out.push(order[(i + 4) % n]);      // from wave 25 they come in pairs
    return out;
}
// big title card when a boss shows up
let bossIntroT = 0, bossIntroList = [];
function bossIntro(cfg) {
    if (!cfg.boss || currentGameState === 'main') return;
    let el = $('boss-intro');
    if (!el) {
        el = document.createElement('div'); el.id = 'boss-intro';
        el.style.cssText = 'position:fixed;left:50%;top:24%;transform:translateX(-50%);text-align:center;pointer-events:none;z-index:30;transition:opacity .4s;opacity:0;width:min(640px,92vw);text-shadow:0 3px 10px #000,0 0 2px #000';
        document.body.appendChild(el);
    }
    if (bossIntroT <= 0) bossIntroList = [];
    if (bossIntroList.includes(cfg)) return;
    bossIntroList.push(cfg);
    const duo = bossIntroList.length > 1;
    el.innerHTML = bossIntroList.slice(-2).map(c => `<div style="font-weight:900;letter-spacing:.3em;font-size:${duo ? 11 : 13}px;color:${c.bar}">${c.title}</div>` +
        `<div style="font-weight:900;font-size:${duo ? 'clamp(22px,3.4vw,34px)' : 'clamp(28px,5vw,52px)'};line-height:1.05;color:#fff;letter-spacing:.04em">${c.name.toUpperCase()}</div>` +
        `<div style="font-weight:700;font-size:${duo ? 12 : 13}px;color:#e5e7eb;margin:4px auto ${duo ? 8 : 14}px;max-width:520px">${c.tip}</div>`).join('');
    el.style.opacity = '1'; bossIntroT = 5;
    sfx('roar');
    life.bossSeen = life.bossSeen || {};
    if (!life.bossSeen[cfg.id]) { life.bossSeen[cfg.id] = 1; saveJSON('blocky21_life', life); }
}
function tickBossIntro(dt) { if (bossIntroT > 0 && (bossIntroT -= dt) <= 0) { const el = $('boss-intro'); if (el) el.style.opacity = '0'; } }
function bossDefeated(cfg) {
    life.bossKills = life.bossKills || {};
    life.bossKills[cfg.id] = (life.bossKills[cfg.id] || 0) + 1;
    toast(`${cfg.name.toUpperCase()} DEFEATED!`, cfg.bar, 2.6);
    saveJSON('blocky21_life', life);
}


// Far-away ordinary zombies think less often (every 2nd / 3rd frame, with the time they missed added up), which
// is invisible at that distance and cuts the AI + collision cost of a big wave. Anything that shoots, casts or is a boss always updates.
let aiTick = 0;
const LOD_FREE = { crawler: 1, blighter: 1, zero: 1, ranged: 1, marksman: 1, medic: 1, necro: 1, warlord: 1, acolyte: 1, egg: 1 };
function updateEnemies(dtFrame) {
    const T = aiTargets();
    aiTick++;
    let pos = camera.position, pFeet = feetY;
    const ld = lvlDmg();
    if (NET.slowT > 0) NET.slowT -= dtFrame;


    for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const enemy = enemies[ei];
        if (!enemy) continue;
        const u = enemy.userData;
        if (u.dead) continue;
        const cfg = u.config;
        let delta = dtFrame;
        if (u.lodD > 40 && !cfg.boss && !LOD_FREE[cfg.ai] && u.state !== 'charge' && u.state !== 'windup' && !(u.fuse >= 0) && !(u.burnT > 0)) {
            u.lodAcc = (u.lodAcc || 0) + dtFrame;
            if ((aiTick + ei) % (u.lodD > 70 ? 3 : 2)) continue;
            delta = u.lodAcc; u.lodAcc = 0;
        } else u.lodAcc = 0;

        if (u.flash > 0) { u.flash -= delta; if (u.flash <= 0) { u.mat.emissive.setHex(u.baseEmissive); u.mat.emissiveIntensity = u.baseEmissiveI; } }
        if (u.attackCooldown > 0) u.attackCooldown -= delta;
        if (u.rage > 0) u.rage -= delta;
        if (u.burnT > 0) {   // 3.8: on fire (Flamethrower): burns every quarter second
            u.burnT -= delta; u.burnAcc = (u.burnAcc || 0) + delta;
            if (u.burnAcc >= 0.25) { u.burnAcc -= 0.25; spawnParticles(new V3(enemy.position.x, enemy.position.y + u.totalHeight * 0.55, enemy.position.z), Math.random() < 0.5 ? 0xff6a1f : 0xffb020, 2, 2.5, 0.5, 0.3 * cfg.scale, false, { grav: -4 }); damageEnemy(enemy, u.burnDps * 0.25, false, null, true, null, 1, 'flamer'); if (u.dead) continue; }
        }


        const sx0 = enemy.position.x, sz0 = enemy.position.z;   // start-of-frame spot (charge wall check)
        _aiT = pickAITarget(u, enemy, T, delta); pos = _aiT.pos; pFeet = _aiT.feet;
        // sentry decoy: brawlers near a sentry stop chasing you and go smash it instead
        let decoy = null;
        if (turrets.length && (cfg.ai === 'melee' || cfg.ai === 'shielder')) {
            if ((u.decoyT = (u.decoyT || 0) - delta) <= 0) { u.decoyT = 0.4; u.decoy = pickDecoy(enemy); }
            if (u.decoy && u.decoy.hp > 0 && turrets.includes(u.decoy)) decoy = u.decoy; else u.decoy = null;
        } else u.decoy = null;
        const tgt = decoy ? decoy.g.position : pos;
        const dx = tgt.x - enemy.position.x, dz = tgt.z - enemy.position.z;
        const hd = Math.hypot(dx, dz) || 0.0001;
        u.lodD = hd;
        const vGap = (decoy ? tgt.y : pFeet) - enemy.position.y;            // + means the target is above
        let faceX = dx, faceZ = dz;


        let mx = dx / hd, mz = dz / hd, wantMove = true, spMul = 1, custom = false;
        // pathfinding: follow the flow field around walls / up stairs when the straight line doesn't work
        if (!decoy) {
            const nearGoal = u.navOn && Math.hypot(u.gx - enemy.position.x, u.gz - enemy.position.z) < 0.6;
            if ((u.navT = (u.navT || 0) - delta) <= 0 && (u.onGround || nearGoal) || (nearGoal && u.onGround)) {
                u.navT = 0.18 + Math.random() * 0.1;
                const on = navSteer(enemy.position.x, enemy.position.z, enemy.position.y, pos.x, pos.z, pFeet);
                // a little stickiness so it doesn't flip between "path" and "straight at you" every check
                if (on) { u.navOn = true; u.navHold = 0.6; u.gx = navGoal.x; u.gz = navGoal.z; u.gy = navGoal.y; }
                else if ((u.navHold = (u.navHold || 0) - 0.25) <= 0) u.navOn = false;
            }
            if (u.navOn) {
                const gx = u.gx - enemy.position.x, gz = u.gz - enemy.position.z, gl = Math.hypot(gx, gz);
                // right on top of the waypoint: keep going the way we were (aiming at it would flip back and forth)
                if (gl > 0.6) { mx = gx / gl; mz = gz / gl; }
                else if (u.mdx !== undefined && Math.hypot(u.mdx, u.mdz) > 0.2) { const l = Math.hypot(u.mdx, u.mdz); mx = u.mdx / l; mz = u.mdz / l; }
                if (hd > 6) { faceX = mx; faceZ = mz; }
            }
        } else u.navOn = false;
        const meleeRange = 1.5 + u.radius;
        const inMelee = hd < meleeRange && vGap < 1.3 && vGap > -(u.totalHeight * 0.8);
        // just got shoved out of punching range by the crowd? pause a moment instead of shuffling back and forth
        if (inMelee) u.holdT = 0.35; else if (u.holdT > 0) u.holdT -= delta;
        const holdMelee = !inMelee && u.holdT > 0 && hd < meleeRange + 0.9;
        // 3.9: bosses get ENRAGED below half health (phase 2: faster, new and nastier attacks)
        if (cfg.boss && !u.phase2 && u.hp < u.maxHp * 0.5) {
            u.phase2 = true; u.speed *= 1.2;
            toast(`${cfg.name.toUpperCase()} IS ENRAGED!`, cfg.bar, 2.2); sfx('roar'); bossNet({ k: 'rage', n: cfg.name, c: cfg.bar });
            spawnBlastFx(new V3(enemy.position.x, enemy.position.y + 0.2, enemy.position.z), 7, cfg.eye, true, 0.7);
            if (cfg.ai === 'necro') u.acoT = Math.min(u.acoT ?? 5, 5);
        }
        const bp = (k) => new V3(enemy.position.x, enemy.position.y + k * cfg.scale, enemy.position.z);


        switch (cfg.ai) {
            case 'ranged': {
                // spitters only reach SPIT_RANGE: they walk in until you're in range, then hold and spit
                if (hd < 10) { mx = -mx; mz = -mz; } else if (hd < SPIT_RANGE - 4) wantMove = false;
                u.shootCooldown -= delta;
                if (u.shootCooldown <= 0 && hd < SPIT_RANGE && u.onGround) {
                    u.shootCooldown = 2.4 + Math.random() * 1.2;
                    const from = new V3(enemy.position.x, enemy.position.y + 2.5 * cfg.scale, enemy.position.z);
                    const to = new V3(pos.x, pos.y - 0.5, pos.z);
                    const v = to.sub(from).normalize().multiplyScalar(24);
                    const orb = new THREE.Mesh(_orbGeo, _spitMat);
                    orb.position.copy(from); scene.add(orb);
                    projectiles.push({ kind: 'spit', mesh: orb, vel: v, life: (SPIT_RANGE + 4) / 24, damage: cfg.damage * ld, from: enemy.position.clone() });
                    if (NET.inGame) netSendSpit(from, v);
                    sfx('spit');
                }
                break;
            }
            case 'bomber': {
                if (u.fuse < 0 && hd < 3.6 && Math.abs(vGap) < 3) { u.fuse = 0.55; sfx('beep'); }
                if (u.fuse >= 0) {
                    u.fuse -= delta; wantMove = hd > 1.5;
                    if (u.extra) u.extra.visible = Math.floor(u.fuse * 20) % 2 === 0;
                    if (u.fuse <= 0) { killEnemy(enemy, true); continue; }
                }
                break;
            }
            case 'charger': {
                u.aiT -= delta;
                if (u.state === 'windup') {
                    wantMove = false; u.stateT -= delta;
                    enemy.position.x += (Math.random() - 0.5) * 0.06; // pawing the ground
                    if (u.stateT <= 0) { u.state = 'charge'; u.stateT = 1.15; u.cdir.set(dx / hd, 0, dz / hd); sfx('charge'); }
                } else if (u.state === 'charge') {
                    custom = true; u.stateT -= delta;
                    const st = 21 * delta;
                    enemy.position.x += u.cdir.x * st; enemy.position.z += u.cdir.z * st;
                    faceX = u.cdir.x; faceZ = u.cdir.z; u.walkPhase += st * 1.3 / cfg.scale;
                    if (Math.random() < 0.5) spawnParticles(new V3(enemy.position.x, enemy.position.y + 0.1, enemy.position.z), 0x8a7f73, 1, 2, 0.5, 0.25, true, { grav: 3, drag: 2 });
                    if (hd < u.radius + 1.1 && vGap < 2 && vGap > -u.totalHeight) {
                        if (_aiT.local) { push.set(0, 0, 0); shake = Math.max(shake, 0.6); }
                        hurtTarget(_aiT, cfg.damage * ld, enemy.position, [u.cdir.x * 11, 6, u.cdir.z * 11], 'a Charger ram');
                        u.state = 'walk'; u.aiT = 7;
                    } else if (u.stateT <= 0) { u.state = 'walk'; u.aiT = 6; }
                } else if (u.state === 'stun') {
                    wantMove = false; u.stateT -= delta;
                    u.head.rotation.y = Math.sin(gameTime * 14) * 0.4;
                    if (u.stateT <= 0) { u.state = 'walk'; u.head.rotation.y = 0; }
                } else {
                    if (u.aiT <= 0 && u.onGround && hd > 5 && hd < 32 && Math.abs(vGap) < 3) {
                        if (losClear(enemy.position.x, enemy.position.y + 1.5, enemy.position.z, pos.x, pos.y - 0.6, pos.z)) { u.state = 'windup'; u.stateT = 1.3; sfx('growl'); }
                        else u.aiT = 0.4;
                    }
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                }
                break;
            }
            case 'leaper': {
                if (u.leaping) {
                    custom = true;
                    enemy.position.x += u.air.x * delta; enemy.position.z += u.air.z * delta;
                    faceX = u.air.x; faceZ = u.air.z; u.airT += delta;
                } else {
                    u.aiT -= delta; spMul = 0.6;
                    // leaps are capped like everything else: no higher than you can jump, and only with a clear line
                    if (u.aiT <= 0 && u.onGround && hd < 40 && hd > 3 && vGap <= NAV_CLIMB && losClear(enemy.position.x, enemy.position.y + 1.2, enemy.position.z, pos.x, pos.y - 0.4, pos.z)) {
                        const T = 0.75 + hd * 0.018;
                        const lead = 0.4;
                        const tx = pos.x + push.x * 0.1 - enemy.position.x, tz = pos.z - enemy.position.z;
                        const dy = pFeet - enemy.position.y;
                        u.air.set(tx / T, 0, tz / T);
                        u.velocityY = (dy + 0.5 * GRAVITY * T * T) / T;
                        u.onGround = false; u.leaping = true; u.airT = 0;
                        sfx('throw');
                    } else if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                }
                break;
            }
            case 'riot': {
                // RIOT BREAKER: its shield soaks bullets from the front. Bash charge (wind-up, then a straight ram), then once the shield is broken it sprints in bare-handed.
                u.aiT -= delta;
                const sh = u.shieldHp > 0;
                if (u.state === 'windup') {
                    wantMove = false; u.stateT -= delta;
                    if (u.stateT <= 0) { u.state = 'charge'; u.stateT = 0.85; u.cdir.set(dx / hd, 0, dz / hd); sfx('charge'); }
                } else if (u.state === 'charge') {
                    custom = true; u.stateT -= delta;
                    const st = 20 * delta;
                    enemy.position.x += u.cdir.x * st; enemy.position.z += u.cdir.z * st;
                    faceX = u.cdir.x; faceZ = u.cdir.z; u.walkPhase += st * 1.3 / cfg.scale;
                    if (Math.random() < 0.4) spawnParticles(new V3(enemy.position.x, enemy.position.y + 0.1, enemy.position.z), 0x8a7f73, 1, 2, 0.5, 0.25, true, { grav: 3, drag: 2 });
                    if (hd < u.radius + 1.3 && vGap < 2 && vGap > -u.totalHeight) {
                        if (_aiT.local) { push.set(0, 0, 0); shake = Math.max(shake, 0.5); }
                        hurtTarget(_aiT, cfg.damage * 1.4 * ld, enemy.position, [u.cdir.x * 13, 5, u.cdir.z * 13], 'a Riot Breaker shield bash');
                        u.state = 'walk'; u.aiT = 5;
                    } else if (u.stateT <= 0) { u.state = 'walk'; u.aiT = 4.5; }
                } else if (u.state === 'stun') {
                    wantMove = false; u.stateT -= delta;
                    u.head.rotation.y = Math.sin(gameTime * 14) * 0.4;
                    if (u.stateT <= 0) { u.state = 'walk'; u.head.rotation.y = 0; }
                } else {
                    spMul = sh ? 0.85 : 1.75;
                    if (sh && u.aiT <= 0 && u.onGround && hd > 4.5 && hd < 15 && Math.abs(vGap) < 2.5) {
                        if (losClear(enemy.position.x, enemy.position.y + 1.5, enemy.position.z, pos.x, pos.y - 0.6, pos.z)) { u.state = 'windup'; u.stateT = 0.8; sfx('growl'); }
                        else u.aiT = 0.5;
                    }
                    if (inMelee) { if (u.onGround) wantMove = false; if (decoy) hitTurret(decoy, u, cfg); else meleeHit(u, cfg, enemy, sh ? 1 : 1.25, [dx / hd * 9, 0, dz / hd * 9]); }
                }
                break;
            }
            case 'crawler': {
                // VENT CRAWLER: lies hidden (invisible, untouchable) until you walk close, then pounces out of the vent and scuttles low and fast
                if (u.hidden) {
                    wantMove = false; custom = true; faceX = dx; faceZ = dz;
                    u.wakeT -= delta;
                    if ((hd < 9.5 && Math.abs(vGap) < 4) || u.wakeT <= 0) crawlerWake(enemy, dx / hd, dz / hd);
                    else if ((u.rattleT = (u.rattleT || 0) - delta) <= 0) { u.rattleT = 1.4 + Math.random() * 1.6; if (hd < 24) { sfxAt('thud', hd); spawnParticles(new V3(enemy.position.x, enemy.position.y + 0.15, enemy.position.z), 0x9ca3af, 2, 1.5, 0.4, 0.1, true, { grav: 4 }); } }
                } else if (u.state === 'pounce') {
                    custom = true; u.stateT -= delta;
                    enemy.position.x += u.cdir.x * 11 * delta; enemy.position.z += u.cdir.z * 11 * delta;
                    faceX = u.cdir.x; faceZ = u.cdir.z; u.walkPhase += 0.6;
                    if (hd < u.radius + 1.2 && vGap < 2 && vGap > -u.totalHeight) { hurtTarget(_aiT, cfg.damage * 1.3 * ld, enemy.position, [u.cdir.x * 5, 3, u.cdir.z * 5], 'a Vent Crawler ambush'); u.state = 'walk'; }
                    else if (u.stateT <= 0) u.state = 'walk';
                } else {
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                }
                break;
            }
            case 'blighter': {
                // BLIGHTER: keeps its distance and lobs toxic canisters ahead of you; each one bursts into a lingering poison cloud (area denial)
                if (hd < 11) { mx = -mx; mz = -mz; } else if (hd < 21) wantMove = false;
                u.shootCooldown -= delta;
                if (u.shootCooldown <= 0 && hd < 36 && u.onGround) {
                    u.shootCooldown = 3.6 + Math.random() * 1.4;
                    const from = bp(2.5), lead = _aiT.local ? 0.9 : 0;
                    const tx = pos.x + (velocity.x || 0) * lead * (_aiT.local ? 1 : 0), tz = pos.z + (velocity.z || 0) * lead * (_aiT.local ? 1 : 0);
                    const ty = groundAt(tx, tz, 0, pFeet + 2), T = 0.9 + hd * 0.02;
                    const fire = { r: 3.4, dps: 9 * ld, t: 9, c: 0x84cc16 };
                    bossTele(tx, ty, tz, fire.r, T, 0x84cc16, () => {});
                    bossShot(from, lobVel(from, tx, ty, tz, T, 20), { c: 0x84cc16, s: 0.9, g: 20, life: T + 0.8, dmg: cfg.damage * ld, fire, by: "a Blighter's toxic cloud" });
                    sfx('throw'); u.armSwing = 0.3;
                }
                if (inMelee) meleeHit(u, cfg, enemy);
                break;
            }
            case 'zero': {
                // PATIENT ZERO: toxic globs, jump-the-shockwave slams, a burrow-and-burst ambush, and (enraged) a toxic nova with a safe hole in the middle
                u.aiT -= delta;
                if (Math.random() < 0.4) spawnParticles(bp(2.8), 0xa3e635, 1, 2, 0.6, 0.3 * cfg.scale, false, { grav: -3 });
                if (u.extra) u.extra.scale.setScalar(1 + Math.sin(gameTime * 4) * 0.1);
                if (u.state === 'burrow') {
                    u.stateT -= delta; spMul = 3.6;
                    if ((u.shimT = (u.shimT || 0) - delta) <= 0) { u.shimT = 0.15; spawnParticles(new V3(enemy.position.x, enemy.position.y + 0.2, enemy.position.z), 0x57534e, 3, 3, 0.6, 0.25, true, { grav: 4 }); }
                    if (hd < 5 || u.stateT <= 0) {
                        wantMove = false; u.state = 'erupt'; u.stateT = 1.1;
                        const c = enemy.position.clone();
                        bossTele(c.x, c.y, c.z, 7, 1.1, 0xa3e635, () => {
                            enemy.visible = true; u.shielded = false; u.barShow = true; u.state = 'walk'; u.aiT = u.phase2 ? 2.2 : 3.2;
                            bossBlast(new V3(c.x, c.y + 0.4, c.z), 7, 34 * ld, 0xa3e635, "Patient Zero's eruption");
                            bossWave(c.x, c.y, c.z, 14, 11, 20 * ld, 0xa3e635, "Patient Zero's shockwave");
                            if (enemies.length < 40) for (let i = 0; i < (u.phase2 ? 3 : 2); i++) bossMinion('crawler', c.x, c.z, c.y, 3, 7);
                            sfx('roar');
                        });
                    }
                } else if (u.state === 'erupt') {
                    wantMove = false; u.stateT -= delta;
                } else if (u.state === 'slam') {
                    wantMove = false; u.stateT -= delta;
                    if (u.stateT <= 0) u.state = 'walk';
                } else if (u.state === 'cast') {
                    wantMove = false; u.stateT -= delta;
                    if (u.stateT <= 0) {
                        u.state = 'walk';
                        const n = u.phase2 ? 7 : 5, from = bp(2.9);
                        for (let i = 0; i < n; i++) {
                            const a = i / n * Math.PI * 2 + Math.random(), rr = i ? 2 + Math.random() * 7 : 0;
                            const lead = _aiT.local ? 0.6 : 0;
                            const tx = pos.x + (velocity.x || 0) * lead + Math.cos(a) * rr, tz = pos.z + (velocity.z || 0) * lead + Math.sin(a) * rr;
                            const ty = groundAt(tx, tz, 0, pFeet + 2), T = 1.0 + hd * 0.015 + i * 0.1;
                            const fire = { r: 3, dps: 11 * ld, t: 7, c: 0x84cc16 };
                            bossTele(tx, ty, tz, fire.r, T, 0x84cc16, () => {});
                            bossShot(from, lobVel(from, tx, ty, tz, T, 20), { c: 0x84cc16, s: 1.2, g: 20, life: T + 0.8, dmg: 16 * ld, boom: 2.4, fire, by: "Patient Zero's toxic glob" });
                        }
                        sfx('throw'); u.aiT = u.phase2 ? 2.4 : 3.4;
                    }
                } else if (u.state === 'nova') {
                    wantMove = false; u.stateT -= delta;
                    if (u.stateT <= 0) u.state = 'walk';
                } else {
                    if (hd < 24) spMul = 0.7;
                    if (u.aiT <= 0 && u.onGround) {
                        const pool = u.phase2 ? ['globs', 'slam', 'burrow', 'nova', 'globs', 'burrow'] : ['globs', 'slam', 'burrow'];
                        let pick = pool[(u.atk = ((u.atk ?? -1) + 1)) % pool.length];
                        if (pick === 'slam' && hd > 22) pick = 'globs';
                        const c = enemy.position.clone();
                        if (pick === 'globs') { u.state = 'cast'; u.stateT = 1.0; sfx('growl'); }
                        else if (pick === 'slam') {
                            u.state = 'slam'; u.stateT = 1.3; sfx('growl');
                            bossTele(c.x, c.y, c.z, 6, 1.1, 0xa3e635, () => { bossBlast(new V3(c.x, c.y + 0.4, c.z), 6, 28 * ld, 0xa3e635, "Patient Zero's slam"); bossWave(c.x, c.y, c.z, 24, 12, 24 * ld, 0xa3e635, "Patient Zero's shockwave"); if (u.phase2) setTimeout(() => { if (!u.dead && currentGameState === 'playing') bossWave(c.x, c.y, c.z, 24, 12, 24 * ld, 0xa3e635, "Patient Zero's shockwave"); }, 700); });
                            u.aiT = u.phase2 ? 2.4 : 3.4;
                        } else if (pick === 'burrow') {
                            u.state = 'burrow'; u.stateT = 3.4; u.shielded = true; enemy.visible = false; u.barShow = false;
                            spawnParticles(bp(1.2), 0x57534e, 18, 6, 0.7, 0.3, true, { grav: 8 }); sfx('slam');
                            toast('PATIENT ZERO BURROWED - KEEP MOVING!', '#a3e635', 1.8);
                        } else {
                            u.state = 'nova'; u.stateT = 2.3; sfx('roar');
                            toast('TOXIC NOVA - STAND IN THE HOLE!', '#a3e635', 2);
                            bossTele(c.x, c.y, c.z, 5, 2.2, 0x38bdf8, () => {});
                            bossTele(c.x, c.y, c.z, 16, 2.2, 0xa3e635, () => bossBlast(new V3(c.x, c.y + 0.4, c.z), 16, 38 * ld, 0xa3e635, "Patient Zero's toxic nova", { r: 2.6, dps: 9 * ld, t: 4, c: 0x84cc16 }, 5));
                            u.aiT = 2.4;
                        }
                    }
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                }
                break;
            }
            case 'shielder': {
                if (inMelee) { if (u.onGround) wantMove = false; if (decoy) hitTurret(decoy, u, cfg); else if (u.attackCooldown <= 0) meleeHit(u, cfg, enemy, 1, [dx / hd * 12, 0, dz / hd * 12]); }
                break;
            }
            case 'marksman': {
                if (u.state === 'aim') {
                    wantMove = false; u.stateT -= delta; u.losT -= delta;
                    u.aimFrom.set(enemy.position.x + (dx / hd) * 1.3 * cfg.scale, enemy.position.y + 2.25 * cfg.scale, enemy.position.z + (dz / hd) * 1.3 * cfg.scale);
                    // the aim lags a little behind you - keep moving!
                    u.aimTo.lerp(_tmp.set(pos.x, pos.y - 0.4, pos.z), Math.min(1, delta * (u.stateT < 0.55 ? 0.8 : 2.4)));
                    if (u.losT <= 0) {
                        u.losT = 0.1;
                        u.hasLos = losClear(u.aimFrom.x, u.aimFrom.y, u.aimFrom.z, pos.x, pos.y - 0.4, pos.z);
                        if (!u.hasLos) u.lostT += 0.1; else u.lostT = 0;
                    }
                    const L = u.laser, len = u.aimFrom.distanceTo(u.aimTo);
                    L.visible = true;
                    L.position.copy(u.aimFrom).lerp(u.aimTo, 0.5);
                    L.quaternion.setFromUnitVectors(_Z, _dir.copy(u.aimTo).sub(u.aimFrom).normalize());
                    const hot = u.stateT < 0.55;
                    L.scale.set(hot ? 0.07 : 0.03, hot ? 0.07 : 0.03, len);
                    L.material.opacity = hot ? (Math.floor(u.stateT * 30) % 2 ? 1 : 0.5) : 0.35 + 0.3 * (1 - u.stateT / 2.1);
                    if (hot && !u.beeped) { u.beeped = true; sfx('lock'); }
                    if (u.lostT > 0.5) { u.state = 'walk'; u.aiT = 1.2; L.visible = false; }
                    else if (u.stateT <= 0) {
                        L.visible = false; u.state = 'walk'; u.aiT = 4.2 + Math.random() * 1.8;
                        const dPlayer = u.aimTo.distanceTo(_tmp.set(pos.x, pos.y - 0.4, pos.z));
                        const clear = losClear(u.aimFrom.x, u.aimFrom.y, u.aimFrom.z, u.aimTo.x, u.aimTo.y, u.aimTo.z);
                        spawnTracer(u.aimFrom, u.aimTo, 0xff4040, 0.09, 0.18);
                        sfx('laser');
                        if (NET.inGame) netSendTracer(u.aimFrom, u.aimTo, 0xff4040);
                        if (clear && dPlayer < 0.75) hurtTarget(_aiT, cfg.damage * ld, enemy.position, null, "a Marksman's laser shot");
                    }
                } else {
                    u.strafeT -= delta; if (u.strafeT <= 0) { u.strafe *= -1; u.strafeT = 1.5 + Math.random() * 2; }
                    if (hd < 18) { mx = -mx; mz = -mz; }
                    else if (hd < 42) { const sx = -dz / hd * u.strafe, sz = dx / hd * u.strafe; mx = sx; mz = sz; spMul = 0.55; }
                    u.aiT -= delta;
                    if (u.aiT <= 0 && u.onGround && hd < 75) {
                        if (losClear(enemy.position.x, enemy.position.y + 2.25 * cfg.scale, enemy.position.z, pos.x, pos.y - 0.4, pos.z)) {
                            u.state = 'aim'; u.stateT = 2.1; u.lostT = 0; u.losT = 0; u.beeped = false;
                            u.aimTo.set(pos.x + (Math.random() - 0.5) * 3, pos.y - 0.4, pos.z + (Math.random() - 0.5) * 3);
                        } else u.aiT = 0.5;
                    }
                    if (inMelee) meleeHit(u, cfg, enemy);
                }
                break;
            }
            case 'screamer': {
                let best = null, bd = 1e9;
                for (const o of enemies) { if (o === enemy || o.userData.dead || o.userData.config.ai === 'screamer') continue; const d = Math.hypot(o.position.x - enemy.position.x, o.position.z - enemy.position.z); if (d < bd) { bd = d; best = o; } }
                if (hd < 14) { mx = -mx; mz = -mz; spMul = 1.15; }
                else if (best) { const bx = best.position.x - pos.x, bz = best.position.z - pos.z, bl = Math.hypot(bx, bz) || 1; const tx = best.position.x + bx / bl * 5 - enemy.position.x, tz = best.position.z + bz / bl * 5 - enemy.position.z, tl = Math.hypot(tx, tz); if (tl < 1.5) wantMove = false; else { mx = tx / tl; mz = tz / tl; } }
                else if (hd < 24) { mx = -mx; mz = -mz; } else wantMove = false;
                if (u.aura) u.aura.material.opacity = 0.15 + 0.12 * Math.sin(gameTime * 3);
                u.aiT -= delta;
                if (u.aiT <= 0 && hd < 45) {
                    u.aiT = 6;
                    let n = 0; for (const o of enemies) { const ou = o.userData; if (o === enemy || ou.dead) continue; if (Math.hypot(o.position.x - enemy.position.x, o.position.z - enemy.position.z) < 18) { ou.rage = 5; n++; } }
                    spawnBlastFx(new V3(enemy.position.x, enemy.position.y + 0.2, enemy.position.z), 18, 0xef4444, true, 0.6);
                    sfxAt('scream', camera.position.distanceTo(enemy.position));
                    if (n && !u.warned) { u.warned = true; toast('A SCREAMER enraged the horde!', '#fca5a5', 1.6); }
                }
                break;
            }
            case 'medic': {
                let best = null, bd = 1e9;
                for (const o of enemies) {
                    if (o === enemy || o.userData.dead || o.userData.config.ai === 'medic') continue;
                    const d = Math.hypot(o.position.x - enemy.position.x, o.position.z - enemy.position.z);
                    if (d < bd) { bd = d; best = o; }
                }
                if (hd < 12) { mx = -mx; mz = -mz; spMul = 1.2; }
                else if (best) {
                    // stand behind an ally, on the far side from you
                    const bx = best.position.x - pos.x, bz = best.position.z - pos.z, bl = Math.hypot(bx, bz) || 1;
                    const tx = best.position.x + bx / bl * 4 - enemy.position.x, tz = best.position.z + bz / bl * 4 - enemy.position.z;
                    const tl = Math.hypot(tx, tz);
                    if (tl < 1.5) wantMove = false; else { mx = tx / tl; mz = tz / tl; }
                } else if (hd < 22) { mx = -mx; mz = -mz; } else wantMove = false;
                u.aiT -= delta;
                if (u.aura) { u.aura.material.opacity = 0.35 + 0.25 * Math.sin(gameTime * 4); }
                if (u.extra) u.extra.scale.setScalar(1 + Math.sin(gameTime * 6) * 0.15);
                if (u.aiT <= 0) {
                    u.aiT = 2.2;
                    let healed = 0;
                    const from = new V3(enemy.position.x, enemy.position.y + 2.4 * cfg.scale, enemy.position.z);
                    for (const o of enemies) {
                        const ou = o.userData;
                        if (o === enemy || ou.dead || ou.hp >= ou.maxHp) continue;
                        if (Math.hypot(o.position.x - enemy.position.x, o.position.z - enemy.position.z) > 11) continue;
                        const amt = Math.min(ou.maxHp - ou.hp, ou.maxHp * 0.2);
                        ou.hp += amt; healed++;
                        const to = new V3(o.position.x, o.position.y + ou.totalHeight * 0.6, o.position.z);
                        spawnTracer(from, to, 0x4ade80, 0.08, 0.35);
                        spawnParticles(to, 0x86efac, 5, 3, 0.6, 0.12, false, { grav: -3 });
                        spawnDamageNumber(to, `+${Math.round(amt)}`, 'heal');
                    }
                    if (healed) sfx('medic');
                }
                if (inMelee) meleeHit(u, cfg, enemy);
                break;
            }
            case 'jugg': {
                // THE JUGGERNAUT: armored (halves bullets) and charges. Hitting a wall stuns it and cracks the armor.
                u.aiT -= delta;
                if (u.state === 'windup') {
                    wantMove = false; u.stateT -= delta;
                    enemy.position.x += (Math.random() - 0.5) * 0.08;
                    if (u.stateT <= 0) { u.state = 'charge'; u.stateT = 1.5; u.cdir.set(dx / hd, 0, dz / hd); sfx('charge'); }
                } else if (u.state === 'charge') {
                    custom = true; u.stateT -= delta;
                    const st = 24 * delta;
                    enemy.position.x += u.cdir.x * st; enemy.position.z += u.cdir.z * st;
                    faceX = u.cdir.x; faceZ = u.cdir.z; u.walkPhase += st * 1.3 / cfg.scale;
                    if (Math.random() < 0.7) spawnParticles(new V3(enemy.position.x, enemy.position.y + 0.1, enemy.position.z), 0x8a7f73, 1, 3, 0.6, 0.4, true, { grav: 3, drag: 2 });
                    if (hd < u.radius + 1.3 && vGap < 2.5 && vGap > -u.totalHeight) {
                        if (_aiT.local) { push.set(0, 0, 0); shake = Math.max(shake, 0.8); }
                        hurtTarget(_aiT, cfg.damage * ld, enemy.position, [u.cdir.x * 14, 7, u.cdir.z * 14], 'the Juggernaut');
                        u.state = 'walk'; u.aiT = 3.5; u.chain = 0;
                    } else if (u.stateT <= 0) {
                        if (u.phase2) slam(enemy.position, 6, 18 * ld, 0xfb923c, "the Juggernaut's stomp");
                        if (u.phase2 && (u.chain = (u.chain || 0) + 1) < 3) { u.state = 'windup'; u.stateT = 0.45; }   // enraged: charges three times in a row
                        else { u.chain = 0; u.state = 'walk'; u.aiT = u.phase2 ? 3 : 4.5; }
                    }
                } else if (u.state === 'stun') {
                    wantMove = false; u.stateT -= delta;
                    u.head.rotation.y = Math.sin(gameTime * 14) * 0.4;
                    if (Math.random() < 0.3) spawnParticles(bp(3.2), 0xfde047, 1, 2, 0.5, 0.15);
                    if (u.stateT <= 0) { u.state = 'walk'; u.head.rotation.y = 0; u.aiT = 2.5; u.chain = 0; }
                } else {
                    if (u.aiT <= 0 && u.onGround && hd > 6 && hd < 45 && Math.abs(vGap) < 3) {
                        if (losClear(enemy.position.x, enemy.position.y + 1.5, enemy.position.z, pos.x, pos.y - 0.6, pos.z)) { u.state = 'windup'; u.stateT = u.phase2 ? 0.75 : 1.15; u.chain = 0; sfx('growl'); }
                        else u.aiT = 0.4;
                    }
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy, 1, [dx / hd * 14, 5, dz / hd * 14]); }
                }
                break;
            }
            case 'brood': {
                // THE BROODMOTHER: keeps her distance, lobs acid that leaves burning pools, lays egg sacs that hatch into Mites
                u.strafeT -= delta; if (u.strafeT <= 0) { u.strafe *= -1; u.strafeT = 2 + Math.random() * 2; }
                if (hd < 12) { mx = -mx; mz = -mz; } else if (hd < 28) { mx = -dz / hd * u.strafe; mz = dx / hd * u.strafe; spMul = 0.7; }
                u.aiT -= delta; u.summonT -= delta;
                if (u.extra) u.extra.scale.setScalar(1 + Math.sin(gameTime * 4) * 0.12);
                if (u.aiT <= 0 && hd < 42 && u.onGround) {
                    u.aiT = u.phase2 ? 2.6 : 3.6;
                    const from = bp(2.4);
                    for (let i = 0, n = u.phase2 ? 5 : 3; i < n; i++) {
                        const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 2 + Math.random() * 3.5;
                        const tx = pos.x + Math.cos(a) * r, tz = pos.z + Math.sin(a) * r, ty = groundAt(tx, tz, 0, pFeet + 2), T = 0.9 + hd * 0.02 + i * 0.08;
                        bossShot(from, lobVel(from, tx, ty, tz, T, 20), { c: 0xa3e635, s: 1.1, g: 20, life: T + 1, dmg: 14 * ld, fire: { r: 2.3, dps: 14 * ld, t: 5, c: 0x84cc16 }, by: "the Broodmother's acid" });
                    }
                    sfx('spit');
                }
                if (u.summonT <= 0 && enemies.length < 50) {
                    u.summonT = u.phase2 ? 8 : 12;
                    for (let i = 0, n = u.phase2 ? 3 : 2; i < n; i++) { const e2 = bossMinion('egg', enemy.position.x, enemy.position.z, enemy.position.y, 2.5, 5); if (e2) e2.userData.hatch = 7; }
                    if (!u.warned) { u.warned = true; toast('SHOOT THE EGG SACS BEFORE THEY HATCH!', '#bef264', 2); }
                    sfx('spit');
                }
                if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                break;
            }
            case 'egg': {
                wantMove = false;
                u.hatch = (u.hatch ?? 7) - delta;
                const k = 1 + Math.sin(gameTime * (5 + (7 - u.hatch) * 1.6)) * (0.06 + (7 - u.hatch) * 0.015);
                u.body.scale.set(k, 2 - k, k);
                if (u.hatch <= 0) {
                    spawnParticles(bp(1), 0xbef264, 14, 7, 0.6, 0.2, false, { grav: 12 });
                    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const m = spawnEnemy(enemyTypes.mite, enemy.position.x + Math.cos(a) * 1.2, enemy.position.z + Math.sin(a) * 1.2, enemy.position.y + 0.5, waveSpeed(playerStats.level), waveReward(playerStats.level)); m.userData.noLoot = true; m.userData.dropping = false; }
                    u.noLoot = true; killEnemy(enemy, true); continue;
                }
                break;
            }
            case 'pyro': {
                // THE INFERNO: fireballs that leave fire, a flame-ring eruption when you're close; enraged it leaves a trail of fire
                u.aiT -= delta; u.slamT -= delta;
                if (Math.random() < 0.5) spawnParticles(bp(3.1), Math.random() < 0.5 ? 0xff6a1f : 0xffd24d, 1, 2.5, 0.5, 0.35 * cfg.scale, false, { grav: -6 });
                if (u.extra) u.extra.scale.setScalar(1 + Math.sin(gameTime * 8) * 0.15);
                if (u.state === 'slam') {
                    wantMove = false; u.stateT -= delta;
                    if (u.stateT <= 0) { u.state = 'walk'; u.slamT = u.phase2 ? 4 : 6; }
                } else {
                    if (hd < 22) spMul = 0.6;
                    if (u.slamT <= 0 && hd < 10 && u.onGround) {
                        u.state = 'slam'; u.stateT = 1.25; sfx('growl');
                        const c = enemy.position.clone();
                        bossTele(c.x, c.y, c.z, 8.5, 1.2, 0xff6a1f, () => bossBlast(new V3(c.x, c.y + 0.4, c.z), 8.5, 30 * ld, 0xff6a1f, "the Inferno's eruption"));
                        if (u.phase2) bossTele(c.x, c.y, c.z, 15, 2.0, 0xff2a1a, () => bossBlast(new V3(c.x, c.y + 0.4, c.z), 15, 24 * ld, 0xff2a1a, "the Inferno's eruption", null, 8));
                    } else if (u.aiT <= 0 && hd > 6 && hd < 45 && u.onGround) {
                        u.aiT = u.phase2 ? 3 : 4.2;
                        const from = bp(2.6);
                        for (let i = 0; i < 3; i++) {
                            const lead = _aiT.local ? 0.5 + i * 0.35 : 0;
                            const tx = pos.x + (velocity.x || 0) * lead * (_aiT.local ? 1 : 0) + (Math.random() - 0.5) * 3, tz = pos.z + (velocity.z || 0) * lead * (_aiT.local ? 1 : 0) + (Math.random() - 0.5) * 3;
                            const ty = groundAt(tx, tz, 0, pFeet + 2), T = 1.0 + hd * 0.015 + i * 0.15;
                            bossShot(from, lobVel(from, tx, ty, tz, T, 20), { c: 0xff6a1f, s: 1.3, g: 20, life: T + 1, dmg: 20 * ld, boom: 3.2, fire: { r: 2.2, dps: 12 * ld, t: 3.5, c: 0xff6a1f }, by: "the Inferno's fireball" });
                        }
                        sfx('throw');
                    }
                    if (u.phase2 && u.onGround && (u.trailT = (u.trailT || 0) - delta) <= 0) { u.trailT = 0.55; bossHazard(enemy.position.x, enemy.position.y, enemy.position.z, 1.9, 14 * ld, 4, 0xff6a1f, "the Inferno's flames"); }
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                }
                break;
            }
            case 'phantom': {
                // THE PHANTOM: vanishes, sneaks around behind you and strikes. Shooting it while it's invisible reveals it.
                u.aiT -= delta;
                if (u.state === 'cloak') {
                    u.stateT -= delta; spMul = 1.7;
                    let bx = pos.x + dx / hd * 3, bz = pos.z + dz / hd * 3;
                    if (_aiT.local) { camera.getWorldDirection(_camDir); _camDir.y = 0; _camDir.normalize(); bx = pos.x - _camDir.x * 2.6; bz = pos.z - _camDir.z * 2.6; }
                    const gx = bx - enemy.position.x, gz = bz - enemy.position.z, gl = Math.hypot(gx, gz) || 1;
                    if (!u.navOn || hd < 8) { mx = gx / gl; mz = gz / gl; }
                    if ((u.shimT = (u.shimT || 0) - delta) <= 0) { u.shimT = 0.22; spawnParticles(bp(1.6), 0x67e8f9, 1, 1, 0.5, 0.12, false, { grav: -1, jitter: 0.5 }); }
                    if (gl < 1.4 || hd < 2.6 || u.stateT <= 0) {
                        u.state = 'windup'; u.stateT = 0.5; enemy.visible = true; sfx('growl');
                        spawnParticles(bp(1.6), 0x67e8f9, 14, 6, 0.5, 0.15);
                    }
                } else if (u.state === 'windup') {
                    wantMove = false; u.stateT -= delta;
                    if (u.stateT <= 0) {
                        u.state = 'walk'; u.aiT = u.phase2 ? 3.5 : 5; u.armSwing = 0.3;
                        if (hd < 4.4 && Math.abs(vGap) < 2.4) hurtTarget(_aiT, cfg.damage * ld, enemy.position, [dx / hd * 10, 4, dz / hd * 10], "the Phantom's blades");
                        spawnBlastFx(bp(1.4).addScaledVector(_tmp.set(dx / hd, 0, dz / hd), 1.8), 2.4, 0x67e8f9, true, 0.25);
                        sfx('throw');
                    }
                } else {
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy, 0.6); }   // its real damage is the ambush slash
                    if (u.aiT <= 0 && u.onGround) {
                        u.state = 'cloak'; u.stateT = 3.4; enemy.visible = false; u.barShow = false;
                        spawnParticles(bp(1.6), 0x67e8f9, 16, 5, 0.6, 0.16); sfxAt('cloak', hd);
                        if (!u.warned) { u.warned = true; toast('THE PHANTOM VANISHED - KEEP MOVING!', '#67e8f9', 1.8); }
                    }
                }
                if (u.phase2 && !u.cloned && enemies.length < 55) {
                    u.cloned = true; u.clones = [];
                    for (let i = 0; i < 3; i++) { const c = bossMinion('phclone', enemy.position.x, enemy.position.z, enemy.position.y, 3, 7); if (c) { c.userData.noLoot = true; u.clones.push(c); } }
                    toast('THE PHANTOM SPLITS INTO DECOYS!', '#67e8f9', 2);
                }
                break;
            }
            case 'warlord': {
                // THE WARLORD: minigun bursts (break line of sight!), rocket strikes on red circles, enraged he calls reinforcements
                u.aiT -= delta; u.slamT -= delta; u.summonT -= delta;
                if (u.state === 'aim') {
                    wantMove = false; u.stateT -= delta;
                    u.aimTo.lerp(_tmp.set(pos.x, pos.y - 0.5, pos.z), Math.min(1, delta * (u.phase2 ? 2.2 : 1.6)));
                    const fwd = _dir.set(u.aimTo.x - enemy.position.x, 0, u.aimTo.z - enemy.position.z).normalize();
                    faceX = fwd.x; faceZ = fwd.z;
                    const from = new V3(enemy.position.x + fwd.x * 1.9 * cfg.scale * 0.6 - fwd.z * 0.68 * cfg.scale, enemy.position.y + 2.0 * cfg.scale, enemy.position.z + fwd.z * 1.9 * cfg.scale * 0.6 + fwd.x * 0.68 * cfg.scale);
                    if (u.stateT > 2.2) { if (Math.random() < 0.5) spawnParticles(from, 0xffb454, 1, 1.5, 0.2, 0.12); }
                    else {
                        u.fireAcc = (u.fireAcc || 0) + delta;
                        while (u.fireAcc > 0.075) {
                            u.fireAcc -= 0.075; u.shotN = (u.shotN || 0) + 1;
                            const to = new V3(u.aimTo.x + (Math.random() - 0.5) * 1.3, u.aimTo.y + (Math.random() - 0.5) * 1.0, u.aimTo.z + (Math.random() - 0.5) * 1.3);
                            to.sub(from).normalize().multiplyScalar(70).add(from);
                            const wall = raySolids(from, _tmp.copy(to).sub(from).normalize(), 70); if (wall) to.copy(wall.point);
                            spawnTracer(from, to, 0xffd27a, 0.05, 0.08);
                            if (NET.inGame && u.shotN % 3 === 0) netSendTracer(from, to, 0xffd27a);
                            if (u.shotN % 2 === 0) sfxAt('minigun', hd);
                            // hit if the bullet passes close to the target's body
                            const tc = _tmp.set(pos.x, pos.y - 0.6, pos.z), ab = to.clone().sub(from), L = ab.length(); ab.divideScalar(L || 1);
                            const tt = clamp(tc.clone().sub(from).dot(ab), 0, L), dist = from.clone().addScaledVector(ab, tt).distanceTo(tc);
                            if (dist < 0.6) hurtTarget(_aiT, 3.2 * ld, enemy.position, null, "the Warlord's minigun");
                        }
                    }
                    if (u.stateT <= 0) { u.state = 'walk'; u.aiT = u.phase2 ? 3 : 4.5; }
                } else {
                    u.strafeT -= delta; if (u.strafeT <= 0) { u.strafe *= -1; u.strafeT = 2 + Math.random() * 2; }
                    if (hd < 14) { mx = -mx; mz = -mz; } else if (hd < 34) { mx = -dz / hd * u.strafe; mz = dx / hd * u.strafe; spMul = 0.6; }
                    if (u.aiT <= 0 && hd < 55 && u.onGround) {
                        if (losClear(enemy.position.x, enemy.position.y + 2 * cfg.scale, enemy.position.z, pos.x, pos.y - 0.4, pos.z)) { u.state = 'aim'; u.stateT = 3.0; u.fireAcc = 0; u.aimTo.set(pos.x, pos.y - 0.5, pos.z); sfxAt('lock', hd); }
                        else u.aiT = 0.5;
                    }
                    if (u.slamT <= 0 && hd < 70) {
                        u.slamT = u.phase2 ? 7 : 10;
                        for (let i = 0, n = u.phase2 ? 6 : 4; i < n; i++) {
                            const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 3 + Math.random() * 5;
                            const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r, y = groundAt(x, z, 0, pFeet + 2);
                            bossTele(x, y, z, 3.2, 1.5 + i * 0.15, 0xef4444, () => bossBlast(new V3(x, y + 0.3, z), 3.4, 24 * ld, 0xff8a3c, "the Warlord's rockets"));
                        }
                        if (!u.warned) { u.warned = true; toast('INCOMING ROCKETS - GET OUT OF THE RED CIRCLES!', '#fca5a5', 2); }
                    }
                    if (u.phase2 && u.summonT <= 0 && enemies.length < 45) {
                        u.summonT = 14;
                        for (const id of ['shielder', 'shielder', 'grunt', 'grunt']) bossMinion(id, enemy.position.x, enemy.position.z, enemy.position.y, 3, 7);
                        toast('THE WARLORD CALLS REINFORCEMENTS', '#fca5a5', 1.6);
                    }
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                }
                break;
            }
            case 'titan': {
                // THE COLOSSUS: stomps send out shockwaves you have to jump, hurls boulders; enraged, its stomps bring rocks down from the sky
                u.slamT -= delta; u.aiT -= delta;
                if (u.state === 'slam') {
                    wantMove = false; u.stateT -= delta;
                    if (u.stateT <= 0) {
                        u.state = 'walk'; u.slamT = u.phase2 ? 4 : 5.5;
                        const c = enemy.position;
                        slam(c, 8, 34 * ld, 0xfbbf24, "the Colossus's stomp");
                        bossWave(c.x, c.y, c.z, 34, 12, 22 * ld, 0xfbbf24, "the Colossus's shockwave");
                        if (u.phase2) for (let i = 0; i < 6; i++) {
                            const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 9;
                            const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r, y = groundAt(x, z, 0, pFeet + 2);
                            bossTele(x, y, z, 2.4, 1.3 + i * 0.15, 0xa8a29e, () => bossBlast(new V3(x, y + 0.3, z), 2.6, 22 * ld, 0xa8a29e, 'falling rocks'));
                        }
                    }
                } else {
                    if (u.slamT <= 0 && hd < 26 && u.onGround) { u.state = 'slam'; u.stateT = 1.1; sfx('growl'); }
                    else if (u.aiT <= 0 && hd > 10 && hd < 60 && u.onGround) {
                        u.aiT = u.phase2 ? 4 : 6;
                        const from = bp(3.3), tx = pos.x, tz = pos.z, ty = groundAt(tx, tz, 0, pFeet + 2), T = 1.3 + hd * 0.012;
                        bossTele(tx, ty, tz, 4, T, 0xf59e0b, null);
                        bossShot(from, lobVel(from, tx, ty, tz, T, 20), { c: 0x8a8378, s: 2.8, g: 20, life: T + 1, dmg: 30 * ld, boom: 4, by: "the Colossus's boulder", lit: true });
                        sfx('throw');
                    }
                    if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy, 1, [dx / hd * 14, 6, dz / hd * 14]); }
                }
                break;
            }
            case 'necro': {
                // THE NECROMANCER: shielded while its Acolytes live, raises the dead, fires homing skulls
                u.shielded = false;
                for (const o of enemies) if (o.userData.master === enemy && !o.userData.dead) { u.shielded = true; break; }
                if (u.bubble) { u.bubble.visible = u.shielded; u.bubble.material.opacity = 0.16 + 0.08 * Math.sin(gameTime * 5); u.bubble.rotation.y += delta * 0.6; }
                u.strafeT -= delta; if (u.strafeT <= 0) { u.strafe *= -1; u.strafeT = 2 + Math.random() * 2; }
                if (hd < 15) { mx = -mx; mz = -mz; } else if (hd < 30) { mx = -dz / hd * u.strafe; mz = dx / hd * u.strafe; spMul = 0.6; }
                u.aiT -= delta; u.summonT -= delta;
                u.acoT = (u.acoT ?? 0.3) - delta;
                if (u.acoT <= 0 && !u.shielded) {
                    u.acoT = u.phase2 ? 22 : 30;
                    for (let i = 0; i < 3; i++) { const a = bossMinion('acolyte', enemy.position.x, enemy.position.z, enemy.position.y, 12, 24); if (a) a.userData.master = enemy; }
                    toast('ACOLYTES SHIELD THE NECROMANCER - KILL THEM!', '#c4b5fd', 2.2);
                }
                if (u.aiT <= 0 && hd < 50 && u.onGround) {
                    u.aiT = u.phase2 ? 1.8 : 2.6;
                    for (const sd of [-1, 1]) {
                        const from = bp(2.6).add(_tmp.set(-dz / hd * sd * 1.2, 0, dx / hd * sd * 1.2));
                        const v = new V3(pos.x - from.x, pos.y - 0.5 - from.y, pos.z - from.z).normalize().multiplyScalar(9);
                        bossShot(from, v, { c: 0xa78bfa, s: 1.1, life: 5, dmg: 13 * ld, home: 2.2, tg: _aiT.id, by: "the Necromancer's skull" });
                    }
                    sfxAt('laser', hd);
                }
                if (u.summonT <= 0 && enemies.length < 50) {
                    u.summonT = u.phase2 ? 7 : 10;
                    let risen = 0; for (const o of enemies) if (o.userData.config.id === 'risen') risen++;
                    for (let i = 0, n = Math.min(u.phase2 ? 4 : 3, 8 - risen); i < n; i++) bossMinion('risen', enemy.position.x, enemy.position.z, enemy.position.y, 3, 7);
                    sfx('growl');
                }
                if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                break;
            }
            case 'acolyte': {
                wantMove = false;
                const m = u.master;
                if ((u.aiT -= delta) <= 0 && m && !m.userData.dead) { u.aiT = 0.3; spawnTracer(bp(2.2), new V3(m.position.x, m.position.y + 2 * m.userData.config.scale, m.position.z), 0xa78bfa, 0.06, 0.3); }
                break;
            }
            case 'boss': {
                u.slamT -= delta; u.summonT -= delta;
                if (u.state === 'slam') {
                    wantMove = false; u.stateT -= delta;
                    u.armL.rotation.x = u.armR.rotation.x = -Math.PI * 0.9;
                    if (u.stateT <= 0) {
                        u.state = 'walk'; u.slamT = u.phase2 ? 3.5 : 4.5; slam(enemy.position, 9, 32 * ld, 0xc084fc, "the Abomination's ground slam");
                        if (u.phase2) bossWave(enemy.position.x, enemy.position.y, enemy.position.z, 24, 13, 20 * ld, 0xc084fc, "the Abomination's shockwave");
                    }
                } else {
                    if (u.slamT <= 0 && hd < 7.5 && u.onGround && Math.abs(vGap) < 3) { u.state = 'slam'; u.stateT = 0.55; sfx('growl'); }
                    else if (inMelee) { if (u.onGround) wantMove = false; meleeHit(u, cfg, enemy); }
                    if (u.summonT <= 0 && enemies.length < 50) {
                        u.summonT = u.phase2 ? 9 : 13;
                        for (let i = 0; i < (u.phase2 ? 3 : 2); i++) {
                            const a = Math.random() * Math.PI * 2;
                            let sx = clamp(enemy.position.x + Math.cos(a) * 4, -ARENA + 5, ARENA - 5), sz = clamp(enemy.position.z + Math.sin(a) * 4, -ARENA + 5, ARENA - 5), sy = enemy.position.y + 3;
                            if (VOID) { const sp = navSpot(enemy.position.x, enemy.position.z, 0, 12) || navSpot(enemy.position.x, enemy.position.z, 0, 40); if (!sp) continue; sx = sp[0]; sz = sp[2]; sy = sp[1] + 3; }
                            spawnEnemy(enemyTypes.sprinter, sx, sz, sy, waveSpeed(playerStats.level), waveReward(playerStats.level));
                            spawnParticles(new V3(sx, enemy.position.y + 1.5, sz), 0xc084fc, 10, 6, 0.6, 0.14);
                        }
                        toast('THE ABOMINATION CALLS FOR BACKUP', '#e879f9', 1.4);
                    }
                }
                break;
            }
            default:
                if (inMelee) { if (u.onGround) wantMove = false; if (decoy) hitTurret(decoy, u, cfg); else meleeHit(u, cfg, enemy); }
        }


        // stuck / under-a-roof handling: strafe for a moment
        if (holdMelee && !custom && u.onGround && cfg.ai !== 'ranged' && cfg.ai !== 'medic' && cfg.ai !== 'marksman') wantMove = false;
        if (!custom && u.wanderT > 0) { u.wanderT -= delta; mx = u.wanderDir.x; mz = u.wanderDir.z; wantMove = true; }
        // turn smoothly instead of snapping to a new direction every frame (no more twitching)
        if (!custom) {
            if (u.mdx === undefined) { u.mdx = mx; u.mdz = mz; }
            const k = 1 - Math.exp(-(u.wanderT > 0 ? 14 : 9) * delta);
            u.mdx += (mx - u.mdx) * k; u.mdz += (mz - u.mdz) * k;
            const ml = Math.hypot(u.mdx, u.mdz);
            if (ml > 0.2) { mx = u.mdx / ml; mz = u.mdz / ml; }
        }


        const feet = enemy.position.y, top = feet + u.totalHeight, ox = enemy.position.x, oz = enemy.position.z;
        if (!custom && wantMove && !(VOID && u.dropping)) {       // (on Sky Islands they don't steer while dropping in from the sky)
            const step = u.speed * spMul * (u.rage > 0 ? 1.45 : 1) * delta;
            // Sky Islands: don't walk off the edge of a cloud (being knocked off is another story)
            if (VOID && u.onGround && !skyOK(enemy.position.x + mx * (step + u.radius * 0.6), enemy.position.z + mz * (step + u.radius * 0.6), feet)) { mx = 0; mz = 0; }
            enemy.position.x += mx * step; enemy.position.z += mz * step;
            u.walkPhase += step * 1.6 / cfg.scale;
        }
        // knockback from explosions / shotgun blasts
        if (u.knock.lengthSq() > 0.01) { enemy.position.addScaledVector(u.knock, delta); u.knock.multiplyScalar(Math.max(0, 1 - 5 * delta)); }


        // --- JUMPING: look at what's ahead and jump exactly as high as needed ---
        if (!custom && u.onGround && wantMove) {
            const ax = enemy.position.x + mx * (u.radius + 0.45), az = enemy.position.z + mz * (u.radius + 0.45);
            let need = 0;
            const near = nearSolids(ax, az, 0.3);
            for (let i = 0; i < near.length; i++) {
                const b = near[i];
                if (ax > b.min.x - 0.2 && ax < b.max.x + 0.2 && az > b.min.z - 0.2 && az < b.max.z + 0.2) {
                    if (b.max.y > feet + STEP && b.min.y < top && b.max.y - feet > need) need = b.max.y - feet;
                }
            }
            // the path says "jump up here" (onto a step or ledge that may be above head height)
            if (u.navOn && u.gy - feet > STEP && Math.hypot(u.gx - enemy.position.x, u.gz - enemy.position.z) < 0.9 + u.radius) need = Math.max(need, u.gy - feet);
            // same jump as the player: nothing taller than NAV_CLIMB
            if (need > 0 && need <= NAV_CLIMB + 0.1) {
                const clearance = ceilingAt(enemy.position.x, enemy.position.z, u.radius * 0.5, top) - top;
                if (clearance > need * 0.5) { u.velocityY = Math.min(ENEMY_JUMP_V, Math.sqrt(2 * GRAVITY * (need + 0.9 + u.radius))); u.onGround = false; }
                else if (u.wanderT <= 0) startWander(u, mx, mz, 1.0);   // roof overhead: walk out from under it first
            }
        }


        pushOut(enemy.position, u.radius, feet, top);
        // Sky Islands: never shuffle off a cloud by accident (a real knock-back or a charge can still send them over)
        if (VOID && u.onGround && !custom && u.knock.lengthSq() < 9 && !skyOK(enemy.position.x, enemy.position.z, feet)) { enemy.position.x = ox; enemy.position.z = oz; }
        enemy.position.x = clamp(enemy.position.x, -ARENA + 2, ARENA - 2); enemy.position.z = clamp(enemy.position.z, -ARENA + 2, ARENA - 2);
        // a charging charger that slams into a wall gets stunned
        if (custom && u.state === 'charge' && Math.hypot(enemy.position.x - sx0, enemy.position.z - sz0) < 27 * delta * 0.35) {
            u.state = 'stun'; u.stateT = cfg.armor ? 3.2 : 1.8; sfx('thud');
            spawnParticles(new V3(enemy.position.x + u.cdir.x, enemy.position.y + 2, enemy.position.z + u.cdir.z), 0xfde047, 8, 4, 0.8, 0.12);
            shake = Math.max(shake, clamp(0.5 - hd / 40, 0, 0.4));
            if (cfg.armor) { spawnDamageNumber(bp(3.4), 'ARMOR CRACKED!', 'head'); slam(enemy.position, 5, 14 * ld, 0xfde047, 'the Juggernaut crashing'); }
            else toastOnce(u, 'STUNNED! +50% DAMAGE');
        }


        // vertical physics
        u.velocityY -= GRAVITY * delta;
        let ny = feet + u.velocityY * delta;
        if (u.velocityY > 0) {
            const ceil = ceilingAt(enemy.position.x, enemy.position.z, u.radius * 0.5, top);
            if (ny + u.totalHeight > ceil) { ny = ceil - u.totalHeight; u.velocityY = 0; }
        }
        const gY = groundAt(enemy.position.x, enemy.position.z, VOID ? Math.max(0.42, u.radius * 0.7) : u.radius * 0.4, feet);
        if (ny <= gY) { ny = gY; u.velocityY = 0; u.onGround = true; u.dropping = false; } else u.onGround = false;
        enemy.position.y = ny;
        if (VOID && ny < FALL_DEATH_Y) { u.noLoot = true; killEnemy(enemy, !!cfg.boss); continue; }     // fell off the clouds (counts as your kill)
        if (u.leaping && u.onGround && u.airT > 0.15) {
            u.leaping = false; u.aiT = 1.3 + Math.random() * 0.8;
            slam(enemy.position, 4.2, cfg.damage * ld, 0xf472b6, 'a Leaper landing on you');
        }
        if (u.leaping && u.airT > 3) u.leaping = false;


        // stuck detection (sample twice a second)
        u.stuckT += delta;
        if (u.stuckT > 0.5) {
            const moved = Math.hypot(enemy.position.x - u.lastX, enemy.position.z - u.lastZ);
            if (!custom && wantMove && u.onGround && u.wanderT <= 0 && moved < u.speed * spMul * 0.5 * 0.25) startWander(u, mx, mz, 0.9);
            u.lastX = enemy.position.x; u.lastZ = enemy.position.z; u.stuckT = 0;
        }


        // far enemies stop casting shadows (saves a shadow draw per body part)
        const far = hd > 42;
        if (far !== u.far) { u.far = far; for (const m of u.shadowParts) m.castShadow = !far; }


        // animation
        const wantRot = Math.atan2(faceX, faceZ);
        let dRot = wantRot - enemy.rotation.y; dRot = Math.atan2(Math.sin(dRot), Math.cos(dRot));
        enemy.rotation.y += custom ? dRot : dRot * (1 - Math.exp(-12 * delta));
        const moving = (wantMove || custom) && u.onGround;
        const sw = Math.sin(u.walkPhase) * (moving ? 0.75 : 0.1);
        u.legL.rotation.x = sw; u.legR.rotation.x = -sw * u.limp;
        if (!u.onGround) { u.legL.rotation.x = 0.5; u.legR.rotation.x = -0.3; }
        if (u.armSwing > 0) u.armSwing -= delta;
        const reach = -Math.PI / 2 + (u.armSwing > 0 ? -0.9 * Math.sin(Math.PI * u.armSwing / 0.3) : 0);
        if (cfg.ai === 'ranged' || cfg.ai === 'medic') { u.armL.rotation.x = -sw; u.armR.rotation.x = sw; }
        else if (cfg.ai === 'marksman') { u.armR.rotation.x = u.state === 'aim' ? -Math.PI / 2 : -0.4; u.armL.rotation.x = u.state === 'aim' ? -1.3 : -sw; u.armL.rotation.z = u.state === 'aim' ? -0.5 : 0; }
        else if (cfg.ai === 'crawler') { u.armL.rotation.x = -2.3 + sw * 0.5; u.armR.rotation.x = -2.3 - sw * 0.5; }
        else if (cfg.ai === 'blighter') { u.armL.rotation.x = u.armR.rotation.x = u.armSwing > 0 ? -2.2 : -1.2; }
        else if (cfg.ai === 'shielder' || cfg.ai === 'riot') { u.armL.rotation.x = u.shieldHp > 0 || cfg.ai === 'shielder' ? -1.2 : reach * 0.8; u.armR.rotation.x = reach * 0.6 - sw * 0.25; }
        else if (cfg.ai === 'shielder') { u.armL.rotation.x = -1.2; u.armR.rotation.x = reach * 0.6 - sw * 0.25; }
        else if (cfg.boss && u.state === 'slam') { u.armL.rotation.x = u.armR.rotation.x = -Math.PI * 0.9; }
        else if (cfg.ai === 'warlord') { u.armR.rotation.x = u.state === 'aim' ? -Math.PI / 2 : -0.45 - sw * 0.1; u.armL.rotation.x = -sw * 0.6; }
        else if (cfg.ai === 'acolyte') { acolytePose(u); }
        else if (cfg.ai === 'egg') { /* no limbs */ }
        else if (cfg.ai === 'necro') { u.armR.rotation.x = -0.25; u.armL.rotation.x = u.state === 'slam' ? -2.6 : -1.2 + sw * 0.2; }
        else if (u.state === 'charge') { u.armL.rotation.x = u.armR.rotation.x = 0.6; }
        else if (u.state === 'windup') { u.armL.rotation.x = u.armR.rotation.x = -2.4 + Math.sin(gameTime * 20) * 0.2; }
        else if (u.leaping) { u.armL.rotation.x = u.armR.rotation.x = -2.6; }
        else zombieArms(u, reach, sw);
        if (u.state !== 'stun') zombieHead(u);
        animReact(u, enemy, delta, cfg);
        if (cfg.id === 'spitter' && u.extra) u.extra.scale.setScalar(1 + Math.sin(gameTime * 5) * 0.12);
    }


    // keep enemies from stacking inside each other (eased out over a few frames, so crowds don't jitter)
    const sepK = Math.min(1, dtFrame * 9);
    for (let i = 0; i < enemies.length; i++) {
        const a = enemies[i];
        for (let j = i + 1; j < enemies.length; j++) {
            const b = enemies[j];
            const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
            const min = a.userData.radius + b.userData.radius;
            const d2 = dx * dx + dz * dz;
            if (d2 < min * min && d2 > 1e-6 && Math.abs(a.position.y - b.position.y) < 2) {
                const d = Math.sqrt(d2), p = (min - d) * 0.5 * sepK;
                const nx = dx / d, nz = dz / d;
                // (on Sky Islands the crowd never shoves anyone off a cloud)
                if (!VOID || skyOK(a.position.x - nx * p, a.position.z - nz * p, a.position.y)) { a.position.x -= nx * p; a.position.z -= nz * p; }
                if (!VOID || skyOK(b.position.x + nx * p, b.position.z + nz * p, b.position.y)) { b.position.x += nx * p; b.position.z += nz * p; }
            }
        }
    }
}
function acolytePose(u) {   // kneeling, both hands raised, swaying as it chants
    const y = (HIP_Y - 0.82) * u.config.scale;
    u.legL.position.y = u.legR.position.y = u.body.position.y = y;
    u.legL.rotation.x = u.legR.rotation.x = 1.45;
    u.armL.rotation.x = u.armR.rotation.x = -2.5 + Math.sin(gameTime * 3 + u.walkPhase) * 0.15;
    u.armL.rotation.z = -0.3; u.armR.rotation.z = 0.3;
}
function toastOnce(u, msg) { if (!u.toasted) { u.toasted = true; spawnDamageNumber(new V3(0, 0, 0).copy(u.head.getWorldPosition(new V3())), msg, 'boom'); } }
function startWander(u, mx, mz, dur) {
    const sign = Math.random() < 0.5 ? 1 : -1;
    // mostly sideways, a little backwards
    u.wanderDir.set(-mz * sign - mx * 0.3, 0, mx * sign - mz * 0.3).normalize();
    u.wanderT = dur * (0.7 + Math.random() * 0.6);
}
