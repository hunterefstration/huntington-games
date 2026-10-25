// ==========  4.0 NEW WEAPONS: railgun, tesla gun, grenade launcher, katana  ==========
function autoReloadSoon(id, ms) {
    if (ammoState[id] <= 0) setTimeout(() => { if (currentGameState === 'playing' && playerStats.currentWeapon === id && ammoState[id] <= 0) triggerReload(); }, ms);
}
// ---------- RAILGUN: hold to charge (railC 0..1), let go to fire. Damage scales with the charge ----------
function railTick(w) {
    const id = w.id;
    if (railC > 0 && (!canShoot() || isReloading || ammoState[id] <= 0)) railCancel();
    if (isMouseDown) {
        if (triggerFresh && !isReloading && ammoState[id] <= 0) { sfx('dry'); triggerReload(); return; }
        const ready = canShoot() && !isReloading && ammoState[id] > 0 && (gameTime - lastShootTime) * 1000 >= w.fireRate;
        if (!ready) return;
        if (!railOn) { railOn = true; railHum = sfxHum(railTime(w)); railHold = 0; railStart = gameTime; }
        const was = railC;
        railC = Math.max(0.001, Math.min(1, (gameTime - railStart) / railTime(w)));
        if (railC >= 1) { if (was < 1) sfx('railfull'); railHold = gameTime - railStart - railTime(w); if (railHold > 2) railRelease(w); }   // it can't hold a full charge for ever
    } else if (railC > 0) { if (railC >= 0.2) railRelease(w); else railCancel(); }
}
const railTime = (w) => w.charge * (adrenOn() && clsUp('assault', 2) ? 0.8 : 1);
function railRelease(w) { lastShootTime = gameTime; fireOnce(w); railCancel(); }
function railCancel() { railC = 0; railHold = 0; railOn = false; stopHum(railHum); railHum = null; setStyle(ui.railRing, 'opacity', '0'); }
const _rbD = new V3(), _rbU = new V3(), _rbV = new V3(), _rbP = new V3();
function railBeamFx(a, b, c) {
    spawnTracer(a, b, tracerColor(0x67e8f9), 0.07 + 0.1 * c, 0.34);
    spawnTracer(a, b, 0xf0fdff, 0.022 + 0.02 * c, 0.22);
    // a spiral of sparks wound round the beam
    const len = a.distanceTo(b); if (len < 0.5) return;
    _rbD.subVectors(b, a).multiplyScalar(1 / len);
    _rbU.set(0, 1, 0).cross(_rbD); if (_rbU.lengthSq() < 0.01) _rbU.set(1, 0, 0); _rbU.normalize(); _rbV.crossVectors(_rbD, _rbU);
    const n = Math.min(28, Math.ceil(len / 1.4));
    for (let i = 1; i <= n; i++) {
        const t = i / n * len, ang = t * 1.7;
        _rbP.copy(a).addScaledVector(_rbD, t).addScaledVector(_rbU, Math.cos(ang) * 0.22).addScaledVector(_rbV, Math.sin(ang) * 0.22);
        spawnParticles(_rbP, i & 1 ? 0x67e8f9 : 0xe0fbff, 1, 0.5, 0.5, 0.07 + 0.05 * c, false, { grav: 0, drag: 2.5 });
    }
    spawnParticles(b, 0xa5f3fc, 8, 6, 0.4, 0.1);
}
// ---------- TESLA GUN: lock on to the zombie nearest the crosshair, then jump on through the crowd ----------
const _tzA = new V3(), _tzB = new V3(), _tzC = new V3(), _tzHit = [], _bf0 = new V3(), _bf1 = new V3();
function boltFx(a, b, k) {
    const d = a.distanceTo(b), n = Math.max(2, Math.min(5, Math.round(d / 2.4))), amp = Math.min(0.75, d * 0.1);
    _bf0.copy(a);
    for (let i = 1; i <= n; i++) {
        if (i < n) _bf1.copy(a).lerp(b, i / n).add(_tzC.set((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp));
        else _bf1.copy(b);
        spawnTracer(_bf0, _bf1, i & 1 ? 0x7c8cff : 0xd4dcff, 0.05 * k, 0.14, true);
        _bf0.copy(_bf1);
    }
}
const zapAt = (e, out) => out.set(e.position.x, e.position.y + e.userData.totalHeight * 0.6, e.position.z);
function teslaFirst(w, o, reach, skip) {
    let first = null, best = -2;
    for (const e of enemies) {
        const u = e.userData; if (u.dead || u.state === 'cloak' || e === skip) continue;
        zapAt(e, _tzA).sub(o); const d = _tzA.length(); if (d > reach + u.radius + 1) continue;
        const cos = _tzA.dot(_fwd) / (d || 1);
        if (cos < Math.cos(Math.min(0.32, Math.atan2(u.radius + 0.7, d) + 0.04))) continue;     // a narrow cone round your crosshair
        const score = cos - d * 0.002;
        if (score > best) { best = score; first = e; }
    }
    return first;
}
function fireTesla(w, dmgMul) {
    const o = camera.position, wall = raySolids(o, _fwd, w.range), reach = wall ? wall.t : w.range;
    vm.zapT = 0.12;
    if (NET.pvp) { teslaPvp(w, dmgMul, reach); return; }
    let first = teslaFirst(w, o, reach, null);
    for (let tries = 0; first && tries < 3; tries++) {     // it can't arc through a wall
        zapAt(first, _tzB); if (losClear(o.x, o.y, o.z, _tzB.x, _tzB.y, _tzB.z)) break;
        const blocked = first; first = teslaFirst(w, o, reach, blocked); if (first === blocked) first = null;
    }
    if (!first) {        // nothing to lock on to: the bolt crackles out to whatever you're pointing at
        _tzB.copy(o).addScaledVector(_fwd, Math.min(reach, 12));
        boltFx(_muzzleW, _tzB, 0.7); spawnParticles(_tzB, 0xc7d2fe, 4, 4, 0.25, 0.06);
        if (NET.inGame) netRecordShot(_muzzleW, _tzB);
        return;
    }
    _tzHit.length = 0; _tzA.copy(_muzzleW);
    let cur = first, dmg = w.damage * dmgMul;
    for (let j = 0; j <= w.chain && cur; j++) {
        zapAt(cur, _tzB);
        boltFx(_tzA, _tzB, j ? 0.85 : 1.15);
        if (j === 0 && NET.inGame) netRecordShot(_muzzleW, _tzB);
        spawnParticles(_tzB, j & 1 ? 0xc7d2fe : 0x818cf8, 5, 5, 0.3, 0.08);
        _tzHit.push(cur);
        cur.userData.zapT = gameTime + 0.16;          // flashes electric blue instead of white
        damageEnemy(cur, dmg, false, _tzB.clone(), false, null, 1, 'tesla');
        // jump to the nearest zombie that hasn't been zapped yet
        let next = null, nd = w.jump * w.jump;
        for (const e of enemies) {
            const v = e.userData; if (v.dead || v.state === 'cloak' || _tzHit.includes(e)) continue;
            const dx = e.position.x - _tzB.x, dy = e.position.y + v.totalHeight * 0.6 - _tzB.y, dz = e.position.z - _tzB.z, d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < nd && Math.abs(dy) < 6) { nd = d2; next = e; }
        }
        _tzA.copy(_tzB); cur = next; dmg *= 0.8;
    }
    runStats.hits++;
}
function teslaPvp(w, dmgMul, reach) {      // PvP: the same, but between enemy players
    const o = camera.position; let first = null, best = -2; const hit = [];
    for (const p of netPlayers.values()) {
        if (!p.av || !p.av.g.visible || p.team === NET.team || !p.alive) continue;
        const P = p.av.g.position; _tzA.set(P.x - o.x, P.y + 1.1 - o.y, P.z - o.z); const d = _tzA.length(); if (d > reach + 1) continue;
        const cos = _tzA.dot(_fwd) / (d || 1); if (cos < Math.cos(Math.min(0.3, Math.atan2(1, d) + 0.03))) continue;
        if (cos > best && losClear(o.x, o.y, o.z, P.x, P.y + 1.1, P.z)) { best = cos; first = p; }
    }
    if (!first) { _tzB.copy(o).addScaledVector(_fwd, Math.min(reach, 12)); boltFx(_muzzleW, _tzB, 0.7); netRecordShot(_muzzleW, _tzB); return; }
    _tzA.copy(_muzzleW); let cur = first, dmg = w.damage * dmgMul;
    for (let j = 0; j <= w.chain && cur; j++) {
        const P = cur.av.g.position; _tzB.set(P.x, P.y + 1.1, P.z);
        boltFx(_tzA, _tzB, j ? 0.85 : 1.15); if (j === 0) netRecordShot(_muzzleW, _tzB);
        hit.push(cur); netQueuePvpHit(cur.id, dmg, false, false, 'tesla'); spawnDamageNumber(_tzB.clone(), Math.round(dmg), '');
        showHitMarker(false, false); sfx('hit');
        let next = null, nd = w.jump * w.jump;
        for (const p of netPlayers.values()) {
            if (!p.av || !p.alive || p.team === NET.team || hit.includes(p)) continue;
            const Q = p.av.g.position, d2 = (Q.x - P.x) ** 2 + (Q.y - P.y) ** 2 + (Q.z - P.z) ** 2; if (d2 < nd) { nd = d2; next = p; }
        }
        _tzA.copy(_tzB); cur = next; dmg *= 0.8;
    }
    runStats.hits++;
}
// ---------- GRENADE LAUNCHER: bouncing grenades, boom on touching a zombie or when the fuse runs out ----------
const _glGeo = new THREE.SphereGeometry(0.15, 10, 8);
const _glMat = new THREE.MeshStandardMaterial({ color: 0x4d5a2b, roughness: 0.55, metalness: 0.3, emissive: 0xfacc15, emissiveIntensity: 0.35 });
const GL_MAX = 12;
function fireGrenade(w, dmgMul, spread) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    _dir.copy(_fwd).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize();
    const mesh = new THREE.Mesh(_glGeo, _glMat); mesh.scale.set(1, 1, 1.4);
    mesh.position.copy(_muzzleW).addScaledVector(_dir, 0.3);
    if (pointInSolid(mesh.position, 0.12)) mesh.position.copy(camera.position).addScaledVector(_dir, 0.35);   // hugging a wall
    mesh.lookAt(_tmp.copy(mesh.position).add(_dir));
    scene.add(mesh);
    let live = 0, oldest = null;
    for (const p of projectiles) if (p.kind === 'gl') { live++; if (!oldest) oldest = p; }
    if (live >= GL_MAX && oldest) { removeProjectile(oldest); glBoom(oldest); }        // cap: the oldest goes off early
    projectiles.push({ kind: 'gl', mesh, vel: _dir.clone().multiplyScalar(36).add(_tmp.set(0, 3.5, 0)), fuse: w.fuse, damage: w.damage * dmgMul, radius: w.radius, trail: 0 });
    spawnParticles(_muzzleW, 0xd6d3d1, 6, 3, 0.5, 0.18, true, { grav: 0, drag: 3 });
    if (NET.inGame) netRecordShot(_muzzleW, _tmp.copy(_muzzleW).addScaledVector(_dir, 4));
}
function glBoom(p) { explode(p.mesh.position.clone(), p.damage, p.radius, { src: 'glauncher', color: 0xffc94d, pre: true }); }
function glTouching(q) {
    for (const e of enemies) {
        const u = e.userData; if (u.dead) continue;
        const dy = q.y - e.position.y;
        if (dy > -0.3 && dy < u.totalHeight + 0.3 && Math.hypot(q.x - e.position.x, q.z - e.position.z) < u.radius + 0.45) return true;
    }
    if (NET.pvp) for (const p of netPlayers.values()) {
        if (!p.av || !p.alive || p.team === NET.team) continue;
        const P = p.av.g.position; if (Math.abs(q.y - P.y - 0.9) < 1.1 && Math.hypot(q.x - P.x, q.z - P.z) < 0.75) return true;
    }
    return false;
}
// ---------- KATANA: slashes cut everything in an arc in front of you; right-click lunges ----------
const SLASH_POSE = [       // [wind-up, end of the cut] offsets: px, py, pz, rx, ry, rz
    [[0.06, 0.05, 0.02, 0.15, -0.55, -0.55], [-0.22, -0.07, -0.04, -0.3, 0.95, 1.05]],      // right to left
    [[-0.12, 0.04, 0.02, 0.1, 0.65, 0.95], [0.14, -0.06, -0.04, -0.25, -0.75, -0.45]],      // backhand, left to right
    [[0.0, 0.09, 0.04, 0.65, 0.05, 0.1], [-0.04, -0.1, -0.06, -1.15, 0.0, 0.05]]           // overhead chop
], _pose = [0, 0, 0, 0, 0, 0];
const LUNGE_TIME = 0.24, LUNGE_DIST = 9;
const _kd = new V3(), _kk = new V3();
function katanaSlash(w) {
    vm.slashDir = (vm.slashDir + 1) % 3; vm.slashDur = Math.min(0.32, w.fireRate / 1000 * 0.95); vm.slashT = vm.slashDur;
    vm.inspect = 0; slashAt = gameTime + vm.slashDur * 0.32;
    runStats.shots++;
    sfx('katana');
    aimPunch += w.punch * (vm.slashDir === 2 ? -1 : 0.4); yawPunch += (vm.slashDir === 0 ? 1 : vm.slashDir === 1 ? -1 : 0) * 0.012;
    if (NET.inGame) { getMuzzleWorld(_muzzleW); netRecordShot(_muzzleW, _muzzleW); }      // teammates hear it
}
const katanaDmg = (w, k = 1) => w.damage * k * clsDmg();
function katanaHits(w) {
    camera.getWorldDirection(_fwd);
    const o = camera.position, fl = Math.hypot(_fwd.x, _fwd.z) || 1, fx = _fwd.x / fl, fz = _fwd.z / fl, dmg = katanaDmg(w);
    let n = 0;
    for (const e of enemies.slice()) {
        const u = e.userData; if (u.dead) continue;
        const dx = e.position.x - o.x, dz = e.position.z - o.z, d = Math.hypot(dx, dz);
        if (d - u.radius > w.range) continue;
        if (e.position.y > o.y + 0.8 || e.position.y + u.totalHeight < feetY - 0.8) continue;             // well above / below you
        if (d > u.radius + 0.7 && (dx * fx + dz * fz) / (d || 1) < w.arc) continue;                       // outside the arc in front of you
        _kk.set(dx / (d || 1), 0, dz / (d || 1));
        damageEnemy(e, dmg * (u.state === 'stun' ? 1.5 : 1), false, new V3(e.position.x, Math.min(o.y, e.position.y + u.totalHeight * 0.6), e.position.z), false, _kk, 5, 'katana');
        spawnParticles(_kd.set(e.position.x - _kk.x * u.radius, Math.min(o.y - 0.2, e.position.y + u.totalHeight * 0.55), e.position.z - _kk.z * u.radius), zLook(u.config).blood, 6, 6, 0.4, 0.11, true, { grav: 20 });
        if (++n >= 12) break;
    }
    if (NET.pvp) for (const p of netPlayers.values()) {
        if (!p.av || !p.alive || p.team === NET.team) continue;
        const P = p.av.g.position, dx = P.x - o.x, dz = P.z - o.z, d = Math.hypot(dx, dz);
        if (d > w.range + 0.4 || Math.abs(P.y - feetY) > 2 || (d > 1 && (dx * fx + dz * fz) / d < w.arc)) continue;
        netQueuePvpHit(p.id, dmg, false, false, 'katana'); spawnDamageNumber(new V3(P.x, P.y + 1.4, P.z), Math.round(dmg), ''); showHitMarker(false, false); n++;
    }
    if (n) { runStats.hits++; sfx('slice'); shake = Math.max(shake, 0.07 + 0.02 * Math.min(n, 5)); }
}
function lunge(w) {
    if (currentGameState !== 'playing' || currentHp <= 0 || lungeT > 0 || vm.melee > 0) return;
    if (lungeCd > 0) { sfx('deny'); return; }
    camera.getWorldDirection(lungeDir); lungeDir.y = 0;
    if (lungeDir.lengthSq() < 0.01) return;
    lungeDir.normalize();
    lungeT = LUNGE_TIME; lungeCd = w.lungeCd; lungeSeq++;
    vm.slashT = 0; slashAt = -1; vm.inspect = 0;
    velocity.x = 0; velocity.z = 0;
    sfx('lunge'); shake = Math.max(shake, 0.14);
    spawnParticles(_kd.set(camera.position.x, feetY + 0.1, camera.position.z), 0x9ca3af, 6, 3, 0.5, 0.18, true, { grav: 4, drag: 3 });
}
// called from updatePlayer: dash along the lunge in small steps (no tunnelling through walls), cutting each zombie you pass once
function lungeStep(dt, pos, bodyH) {
    const step = Math.min(lungeT, dt); lungeT -= step;
    const dist = LUNGE_DIST / LUNGE_TIME * step, n = Math.max(1, Math.ceil(dist / 0.35));
    for (let i = 0; i < n; i++) {
        const nx = pos.x + lungeDir.x * dist / n, nz = pos.z + lungeDir.z * dist / n;
        if (VOID && groundAt(nx, nz, 0.3, feetY + 0.5) < feetY - 2.5) { lungeT = 0; break; }      // Sky Islands: never lunge off the edge
        pos.x = nx; pos.z = nz; pushOut(pos, playerRadius, feetY, feetY + bodyH);
    }
    const w = W(playerStats.currentWeapon);
    if (!w.melee) { lungeT = 0; return; }
    const dmg = katanaDmg(w, w.lunge);
    for (const e of enemies.slice()) {
        const u = e.userData; if (u.dead || u.lungeHit === lungeSeq) continue;
        const dx = e.position.x - pos.x, dz = e.position.z - pos.z, d = Math.hypot(dx, dz) - u.radius;
        if (d > 1.9 || e.position.y > pos.y + 0.8 || e.position.y + u.totalHeight < feetY - 0.8) continue;
        u.lungeHit = lungeSeq;
        // knock them aside, away from your path
        const side = (dx * lungeDir.z - dz * lungeDir.x) >= 0 ? 1 : -1;
        _kk.set(lungeDir.z * side * 0.8 + lungeDir.x * 0.4, 0, -lungeDir.x * side * 0.8 + lungeDir.z * 0.4);
        damageEnemy(e, dmg * (u.state === 'stun' ? 1.5 : 1), false, new V3(e.position.x, Math.min(pos.y, e.position.y + u.totalHeight * 0.6), e.position.z), false, _kk, 8, 'katana');
        spawnParticles(_kd.set(e.position.x, Math.min(pos.y - 0.2, e.position.y + u.totalHeight * 0.55), e.position.z), zLook(u.config).blood, 8, 7, 0.45, 0.12, true, { grav: 20 });
        sfx('slice'); runStats.hits++;
    }
    if (NET.pvp) for (const p of netPlayers.values()) {
        if (!p.av || !p.alive || p.team === NET.team || p.lungeHit === lungeSeq) continue;
        const P = p.av.g.position; if (Math.hypot(P.x - pos.x, P.z - pos.z) > 1.6 || Math.abs(P.y - feetY) > 2) continue;
        p.lungeHit = lungeSeq; netQueuePvpHit(p.id, dmg, false, false, 'katana'); spawnDamageNumber(new V3(P.x, P.y + 1.4, P.z), Math.round(dmg), ''); showHitMarker(false, false);
    }
    if (Math.random() < 0.5) spawnParticles(_kd.set(pos.x, feetY + 0.15, pos.z), 0xd1d5db, 1, 2, 0.35, 0.14, true, { grav: 2, drag: 3 });
    if (lungeT <= 0) { velocity.z = -9; velocity.x = 0; vm.slashDir = 1; katanaSlash(w); }   // carry on a little and finish with a cut
}

// One bullet/pellet: nearest block vs enemy body parts, with piercing and riot shields.
const _box = new THREE.Box3(), _tmp = new V3();
function rayBoxT(o, d, x0, y0, z0, x1, y1, z1) {
    let t0 = 0, t1 = 1e9;
    const O = [o.x, o.y, o.z], D = [d.x, d.y, d.z], A = [x0, y0, z0], Bx = [x1, y1, z1];
    for (let i = 0; i < 3; i++) {
        if (Math.abs(D[i]) < 1e-9) { if (O[i] < A[i] || O[i] > Bx[i]) return -1; continue; }
        let n = (A[i] - O[i]) / D[i], f = (Bx[i] - O[i]) / D[i]; if (n > f) { const t = n; n = f; f = t; }
        if (n > t0) t0 = n; if (f < t1) t1 = f; if (t0 > t1) return -1;
    }
    return t0;
}
function traceShot(origin, dir, w, perEnemy, dmgMul) {
    const env = raySolids(origin, dir, w.range);
    const envT = env ? env.t : w.range;
    const envPoint = env ? env.point.clone() : null, envNormal = env ? env.normal.clone() : null;
    const hits = [];
    raycaster.ray.origin.copy(origin); raycaster.ray.direction.copy(dir);
    raycaster.near = 0; raycaster.far = envT;
    for (const e of enemies) {
        const u = e.userData; if (u.dead || u.hidden) continue;
        const r = u.radius * 2.2;
        _box.min.set(e.position.x - r, e.position.y - 0.1, e.position.z - r);
        _box.max.set(e.position.x + r, e.position.y + u.totalHeight + 0.5 * u.config.scale, e.position.z + r);
        if (!raycaster.ray.intersectBox(_box, _tmp)) continue;
        if (origin.distanceTo(_tmp) > envT) continue;
        e.updateMatrixWorld(true);
        const is = raycaster.intersectObjects(u.hitParts, false);
        if (!is.length) continue;
        hits.push(is[0]);
        // a shield-piercing round still needs to reach the body behind the shield
        if (is[0].object.userData.isShield && w.shieldPierce) { const body = is.find(h => !h.object.userData.isShield); if (body) hits.push(body); }
    }
    hits.sort((a, b) => a.distance - b.distance);
    if (NET.pvp) { const ph = netTraceAvatars(origin, dir, envT, w, dmgMul); if (ph) return ph; }
    // the caged ram: can't be hurt, pays cash per hit
    if (cageRam) {
        const P = cageRam.e.position, t = rayBoxT(origin, dir, P.x - 1, P.y, P.z - 1, P.x + 1, P.y + 4.6, P.z + 1);
        if (t >= 0 && t < envT && (!hits.length || t < hits[0].distance)) {
            const pt = origin.clone().addScaledVector(dir, t);
            cageRamHit(pt, pt.y > P.y + 3.1);
            spawnParticles(pt, 0x9a3412, 3, 5, 0.35, 0.1, true, { grav: 20 });
            return pt;
        }
    }
    let pierce = w.pierce || 0, dmg = w.damage * dmgMul, end = null;
    for (const h of hits) {
        const ud = h.object.userData, e = ud.parentEnemy, u = e.userData;
        if (ud.isShield) {
            spawnParticles(h.point, 0x67e8f9, 5, 6, 0.25, 0.06);
            if (Math.random() < 0.3) sfx('ting');
            if (w.shieldPierce) { if (!w.rail) dmg *= 0.5; continue; }
            if (u.shieldHp > 0) { u.shieldHp -= dmg; if (u.shieldHp <= 0) { breakShield(e, h.point); continue; } }       // 5.0 Riot Breaker: the shield can be shot apart
            if (Math.random() < 0.25) spawnDamageNumber(h.point, 'BLOCKED', 'block');
            end = h.point; break;
        }
        const rec = perEnemy.get(e) || { dmg: 0, head: false, point: h.point.clone(), dir: dir.clone(), hits: 0 };
        rec.dmg += dmg * (ud.isHead ? w.hsMult * (1 + 0.12 * perk('dead')) : 1) * (u.state === 'stun' ? 1.5 : 1);
        rec.head = rec.head || !!ud.isHead; rec.hits++;
        perEnemy.set(e, rec);
        spawnParticles(h.point, zLook(u.config).blood, 3, 5, 0.35, 0.1, true, { grav: 20 });
        if (pierce-- <= 0) { end = h.point; break; }
        if (!w.rail) dmg *= 0.85;          // (4.0 railgun: no fall-off)
    }
    if (!end) {
        if (envPoint) {
            end = envPoint;
            impactFx(envPoint, envNormal, surfaceAt(envPoint, envNormal));
        } else end = origin.clone().addScaledVector(dir, Math.min(w.range, 150));
    }
    return end;
}


function showHitMarker(isHeadshot, isKill) {
    ui.hitMarker.classList.remove('hidden', 'opacity-0');
    ui.hitMarker.classList.add('opacity-100');
    ui.hitMarker.style.transform = isKill ? 'scale(1.5)' : 'scale(1)';
    ui.hitMarkerSvg.classList.toggle('text-red-500', isHeadshot || isKill);
    ui.hitMarkerSvg.classList.toggle('text-white', !isHeadshot && !isKill);
    clearTimeout(showHitMarker._t);
    showHitMarker._t = setTimeout(() => {
        ui.hitMarker.classList.remove('opacity-100');
        ui.hitMarker.classList.add('opacity-0');
    }, isKill ? 220 : 100);
}


function toast(msg, color = '#fde047', dur = 1.6) {
    ui.toast.innerText = msg; ui.toast.style.color = color; ui.toast.style.opacity = '1';
    toastTimer = dur;
}
function showIntel(html, dur = 7) {
    ui.intel.innerHTML = html; ui.intel.classList.remove('hidden');
    intelTimer = dur;
}

// 5.0 Riot Breaker: its shield has health; when it's gone the shield flies off and the zombie is stunned for a moment, then enraged
function breakShield(e, pt) {
    const u = e.userData; u.shieldHp = 0;
    if (u.shield) { u.shield.visible = false; const i = u.hitParts.indexOf(u.shield); if (i >= 0) u.hitParts.splice(i, 1); }
    spawnParticles(pt || e.position, 0x7ee8fa, 16, 8, 0.7, 0.18, true, { grav: 12 }); spawnParticles(pt || e.position, 0xfacc15, 8, 6, 0.6, 0.12, true, { grav: 12 });
    spawnDamageNumber(pt || e.position, 'SHIELD BROKEN', 'head'); sfx('ting'); sfx('thud');
    if (u.state === 'walk' || u.state === 'windup' || u.state === 'charge') { u.state = 'stun'; u.stateT = 0.9; }
    u.rage = Math.max(u.rage || 0, 6);
}
