// ---------- SECONDARIES (Q) ----------
const _grenadeGeo = new THREE.SphereGeometry(0.18, 10, 10), _shellGeo = new THREE.SphereGeometry(0.16, 10, 10), _orbGeo = new THREE.SphereGeometry(0.28, 8, 8);
const _spitMat = new THREE.MeshBasicMaterial({ color: 0xa3e635, toneMapped: false }), _shellMat = new THREE.MeshBasicMaterial({ color: 0xffb454, toneMapped: false });


function useSecondary() {
    if (currentGameState !== 'playing' || currentHp <= 0) return;
    const id = playerStats.currentSecondary;
    if (!id) { toast('No secondary equipped - buy one in the Armory', '#9ca3af'); sfx('deny'); return; }
    const sec = secondariesDb[id];


    if (id === 'c4' && activeC4) { detonateC4(); return; }
    if (secondaryCooldown > 0 && id !== 'turret') { sfx('deny'); return; }


    const dir = new V3(); camera.getWorldDirection(dir);
    const origin = camera.position.clone().addScaledVector(dir, 0.6); origin.y -= 0.15;


    if (id === 'grenade') {
        const mesh = new THREE.Mesh(_grenadeGeo, new THREE.MeshStandardMaterial({ color: sec.color, roughness: 0.6 }));
        mesh.position.copy(origin); mesh.castShadow = true; scene.add(mesh);
        projectiles.push({ kind: 'grenade', mesh, vel: dir.clone().multiplyScalar(26).add(new V3(0, 7, 0)), fuse: 2.0, sec });
        secondaryCooldown = sec.cooldown; sfx('throw'); vm.kickRot -= 0.25;
    } else if (id === 'launcher') {
        const mesh = new THREE.Mesh(_shellGeo, _shellMat);
        mesh.position.copy(origin); scene.add(mesh);
        projectiles.push({ kind: 'shell', mesh, vel: dir.clone().multiplyScalar(62).add(new V3(0, 2, 0)), fuse: 3.5, sec, trail: 0 });
        secondaryCooldown = sec.cooldown; sfx('thump'); vm.kick += 0.12; vm.kickRot += 0.3; shake = Math.max(shake, 0.12);
    } else if (id === 'c4') {
        const grp = new THREE.Group();
        const brick = new THREE.Mesh(sharedBox, new THREE.MeshStandardMaterial({ color: 0xcbb994, roughness: 0.9 })); brick.scale.set(0.4, 0.14, 0.26); grp.add(brick);
        const led = new THREE.Mesh(sharedBox, new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); led.scale.set(0.07, 0.07, 0.07); led.position.y = 0.1; grp.add(led);
        grp.position.copy(origin); scene.add(grp);
        activeC4 = { kind: 'c4', mesh: grp, led, vel: dir.clone().multiplyScalar(17).add(new V3(0, 5, 0)), stuck: false, sec, blink: 0 };
        projectiles.push(activeC4);
        sfx('throw'); vm.kickRot -= 0.25;
        toast('C4 out - press Q to detonate', '#fca5a5', 1.4);
    } else if (id === 'molotov') {
        const mesh = new THREE.Mesh(_grenadeGeo, new THREE.MeshStandardMaterial({ color: 0x7c2d12, emissive: 0xf97316, emissiveIntensity: 0.6, roughness: 0.4 }));
        mesh.scale.set(0.8, 1.3, 0.8); mesh.position.copy(origin); scene.add(mesh);
        projectiles.push({ kind: 'molotov', mesh, vel: dir.clone().multiplyScalar(22).add(new V3(0, 6, 0)), fuse: 4, sec });
        secondaryCooldown = sec.cooldown; sfx('throw'); vm.kickRot -= 0.25;
    } else if (id === 'turret') {
        if (mainTurret()) { toast('Your sentry is still out there', '#9ca3af'); sfx('deny'); return; }
        if (turretCd > 0) { sfx('deny'); return; }
        const p = camera.position.clone().addScaledVector(new V3(dir.x, 0, dir.z).normalize(), 2.6);
        if (pointInSolid(new V3(p.x, feetY + 0.5, p.z), 0.4)) { toast('No room to deploy here', '#9ca3af'); sfx('deny'); return; }
        const ty = groundAt(p.x, p.z, 0.3, feetY + 0.5);
        if (ty < feetY - 3) { toast('No ground to put it on', '#9ca3af'); sfx('deny'); return; }
        deployTurret(p.x, ty, p.z);
        sfx('deploy');
    } else if (id === 'landmine') {
        placeMine(sec);
        secondaryCooldown = sec.cooldown;
    } else if (id === 'heal') {
        if (currentHp >= maxHp) { toast('Already at full health', '#9ca3af'); sfx('deny'); return; }
        currentHp = Math.min(maxHp, currentHp + sec.heal);
        secondaryCooldown = sec.cooldown; sfx('heal');
        screenFlash('rgba(34,197,94,0.45)');
        toast(`+${sec.heal} HP`, '#4ade80', 1.2);
    }
    updateHUD();
}


function detonateC4() {
    if (!activeC4) return;
    const c = activeC4; activeC4 = null;
    projectiles = projectiles.filter(p => p !== c);
    scene.remove(c.mesh);
    secondaryCooldown = c.sec.cooldown;
    explode(c.mesh.position.clone(), c.sec.damage, c.sec.radius);
    updateHUD();
}


function explode(pos, damage, radius, opts = {}) {
    if (opts.mini) {       // explosive-rounds pop: small and cheap
        spawnBlastFx(pos, radius, 0xffa64d, false, 0.25);
        spawnParticles(pos, 0xffc266, 6, 8, 0.35, 0.12);
        sfx('pop');
    } else {
        spawnBlastFx(pos, radius, opts.color || 0xffa64d);
        spawnParticles(pos, 0xffc266, 22, 16, 0.8, 0.18);
        spawnParticles(pos, 0xff5a1f, 12, 12, 0.6, 0.14);
        spawnParticles(pos, 0x4b4b4b, 14, 7, 1.4, 0.35, true, { grav: 2, drag: 1.5, up: 1.5 });
        if (boomLights.length) {
            const bl = boomLights.reduce((a, b) => (a.t <= b.t ? a : b));
            bl.light.position.copy(pos); bl.light.position.y += 1; bl.t = 1; bl.peak = 900 * (1 - 0.8 * theme.bright); bl.light.intensity = bl.peak;
        }
        const dPlayer = pos.distanceTo(camera.position);
        shake = Math.max(shake, clamp(1.4 - dPlayer / 30, 0, 0.9));
        sfx('boom');
    }
    if (opts.fxOnly) return;                    // someone else's explosion: just the show
    if (NET.inGame && !opts.hurtsPlayer && !opts.mini) netSendFx('boom', pos, radius, opts.color || 0xffa64d);
    if (NET.pvp) netExplodeAvatars(pos, damage, radius, opts.src);
    if (NET.inGame && NET.host && opts.hurtsPlayer) netExplodeRemotes(pos, damage, radius, opts.by);
    const dmgMul = opts.pre ? 1 : (!opts.hurtsPlayer && powerOn('dmg') ? 2 : 1) * (!opts.hurtsPlayer && opts.src !== 'turret' ? 1 + 0.08 * perk('dmg') : 1)
                 * (!opts.hurtsPlayer && opts.src !== 'turret' && opts.src !== 'rpg' ? clsDmg() : 1);     // Adrenaline (RPG rockets already have it)


    // damage enemies (explosions ignore riot shields)
    for (const e of [...enemies]) {
        const u = e.userData; if (u.dead) continue;
        const cx = e.position.x, cy = e.position.y + u.totalHeight * 0.5, cz = e.position.z;
        const d = Math.max(0, Math.hypot(cx - pos.x, cy - pos.y, cz - pos.z) - u.radius);
        if (d < radius) {
            const fall = 1 - 0.7 * (d / radius);
            const k = new V3(cx - pos.x, 0, cz - pos.z); if (k.lengthSq() < 0.01) k.set(1, 0, 0);
            k.normalize().multiplyScalar(14 * fall / Math.max(0.8, u.config.scale)); u.knock.add(k);
            u.velocityY = Math.max(u.velocityY, 12 * fall / Math.max(0.8, u.config.scale)); u.onGround = false;
            damageEnemy(e, damage * fall * dmgMul, false, new V3(cx, cy, cz), true, null, 1, opts.src || 'explosive');
        }
    }
    // enemy blasts hurt you; your own explosives never do (they still knock you up - rocket jumps!)
    if (opts.noSelf) return;
    const body = new V3(camera.position.x, feetY + 0.9, camera.position.z);
    const d = body.distanceTo(pos);
    if (d < radius) {
        const fall = 1 - 0.8 * (d / radius);
        if (opts.hurtsPlayer && damage * fall >= 1) takeDamage(damage * fall, pos, opts.by || 'an explosion');
        velocity.y = Math.max(velocity.y, 9 * fall); onGround = false;
    }
}


function updateProjectiles(dt) {
    for (const p of [...projectiles]) {
        if (p.kind === 'c4') {
            p.blink += dt; p.led.visible = (p.blink % 0.5) < 0.25;
            if (!p.stuck) stepBouncy(p, dt, true);
            continue;
        }
        if (p.kind === 'grenade') {
            stepBouncy(p, dt, false);
            p.mesh.rotation.x += dt * 8; p.fuse -= dt;
            p.mesh.material.emissive.setHex(p.fuse < 0.6 && Math.floor(p.fuse * 12) % 2 === 0 ? 0xff2200 : 0);
            if (p.fuse <= 0) { removeProjectile(p); explode(p.mesh.position.clone(), p.sec.damage, p.sec.radius); }
            continue;
        }
        if (p.kind === 'shell') {
            p.vel.y -= 14 * dt; p.fuse -= dt;
            const steps = 3; let boom = false;
            for (let s = 0; s < steps && !boom; s++) {
                p.mesh.position.addScaledVector(p.vel, dt / steps);
                if (p.mesh.position.y <= 0.15 || pointInSolid(p.mesh.position, 0.1)) boom = true;
                else for (const e of enemies) {
                    const u = e.userData; if (u.dead) continue;
                    const dy = p.mesh.position.y - e.position.y;
                    if (dy > -0.3 && dy < u.totalHeight + 0.3 && Math.hypot(p.mesh.position.x - e.position.x, p.mesh.position.z - e.position.z) < u.radius + 0.5) { boom = true; break; }
                }
            }
            p.trail += dt; if (p.trail > 0.02) { p.trail = 0; spawnParticles(p.mesh.position, 0x9a9a9a, 1, 0.5, 0.5, 0.14, true, { grav: 0, drag: 2 }); }
            if (boom || p.fuse <= 0) { removeProjectile(p); explode(p.mesh.position.clone(), p.sec.damage, p.sec.radius, p.noSelf ? { noSelf: true, src: 'turret' } : {}); }
            continue;
        }
        if (p.kind === 'molotov') {
            p.vel.y -= 26 * dt; p.fuse -= dt;
            p.mesh.position.addScaledVector(p.vel, dt); p.mesh.rotation.x += dt * 10;
            if (Math.random() < 0.6) spawnParticles(p.mesh.position, 0xffa24d, 1, 1, 0.3, 0.08, false, { grav: -2 });
            let hit = p.mesh.position.y <= groundAt(p.mesh.position.x, p.mesh.position.z, 0, p.mesh.position.y) + 0.1 || !!pointInSolid(p.mesh.position, 0.1);
            for (const e of enemies) { if (hit) break; const u = e.userData; if (!u.dead && Math.hypot(p.mesh.position.x - e.position.x, p.mesh.position.z - e.position.z) < u.radius + 0.4 && p.mesh.position.y - e.position.y < u.totalHeight) hit = true; }
            if (hit || p.fuse <= 0) {
                removeProjectile(p);
                const q = p.mesh.position;
                makeFire(q.x, groundAt(q.x, q.z, 0, q.y + 0.5), q.z, p.sec);
            }
            continue;
        }
        if (p.kind === 'rocket') {
            p.vel.y -= 2.5 * dt; p.fuse -= dt;
            let boom = false;
            for (let s = 0; s < 4 && !boom; s++) {
                p.mesh.position.addScaledVector(p.vel, dt / 4);
                const q = p.mesh.position;
                if (q.y <= 0.1 || pointInSolid(q, 0.05)) boom = true;
                else for (const e of enemies) {
                    const u = e.userData; if (u.dead) continue;
                    const dy = q.y - e.position.y;
                    if (dy > -0.2 && dy < u.totalHeight + 0.2 && Math.hypot(q.x - e.position.x, q.z - e.position.z) < u.radius + 0.35) { boom = true; break; }
                }
            }
            p.mesh.lookAt(_tmp.copy(p.mesh.position).add(p.vel));
            p.trail += dt;
            if (p.trail > 0.012) { p.trail = 0; spawnParticles(p.mesh.position, 0xffb454, 1, 1, 0.18, 0.1); spawnParticles(p.mesh.position, 0x9a9a9a, 1, 0.6, 0.9, 0.22, true, { grav: -0.5, drag: 2 }); }
            if (boom || p.fuse <= 0) { removeProjectile(p); explode(p.mesh.position.clone(), p.damage, p.radius, { src: 'rpg', color: 0xff8a3c }); }
            continue;
        }
        if (p.kind === 'gl') {        // 4.0 launcher grenade
            p.fuse -= dt;
            let boom = false;
            for (let k = 0; k < 3 && !boom; k++) { stepBouncy(p, dt / 3, false); boom = glTouching(p.mesh.position); }
            p.mesh.rotation.x += dt * 9;
            p.trail += dt; if (p.trail > 0.035) { p.trail = 0; spawnParticles(p.mesh.position, 0xfde68a, 1, 0.4, 0.22, 0.07, false, { grav: 0 }); }
            if (boom || p.fuse <= 0 || p.mesh.position.y < VOID_Y) { removeProjectile(p); glBoom(p); }
            continue;
        }
        if (p.kind === 'bshot') { stepBossShot(p, dt); continue; }
        if (p.kind === 'spit') {
            p.mesh.position.addScaledVector(p.vel, dt); p.life -= dt;
            p.mesh.scale.setScalar(1 + Math.sin(gameTime * 20) * 0.15);
            if (!p.fxOnly) {
                let hitT = null;
                for (const t of aiTargets()) if (t.alive && Math.abs(p.mesh.position.y - (t.feet + 0.9)) < 1.1 && Math.hypot(p.mesh.position.x - t.pos.x, p.mesh.position.z - t.pos.z) < 0.85) { hitT = t; break; }
                if (hitT) { hurtTarget(hitT, p.damage, p.from, null, "a Spitter's acid"); spawnParticles(p.mesh.position, 0x86efac, 8, 5, 0.4, 0.1); removeProjectile(p); continue; }
            }
            if (p.life <= 0 || p.mesh.position.y < 0.05 || pointInSolid(p.mesh.position)) { spawnParticles(p.mesh.position, 0x86efac, 5, 4, 0.35, 0.08); removeProjectile(p); }
        }
    }
}
function removeProjectile(p) { projectiles = projectiles.filter(x => x !== p); scene.remove(p.mesh); }


// Simple per-axis bounce physics for thrown things. sticky=true -> stop on first contact.
function stepBouncy(p, dt, sticky) {
    p.vel.y -= 30 * dt;
    const pos = p.mesh.position; const R = 0.2;
    for (const ax of ['x', 'y', 'z']) {
        const old = pos[ax];
        pos[ax] += p.vel[ax] * dt;
        let hit = pointInSolid(pos, R * 0.5);
        if (ax === 'y' && pos.y < R) { pos.y = R; hit = true; }
        if (hit) {
            if (ax !== 'y' || pos.y !== R) pos[ax] = old;
            if (sticky) { p.stuck = true; p.vel.set(0, 0, 0); sfx('beep'); return; }
            if (p.kind === 'gl' && Math.abs(p.vel[ax]) > 4 && gameTime - (p.clinkT || -1) > 0.12) { p.clinkT = gameTime; sfx('clink'); }
            p.vel[ax] *= -0.45;
            if (ax === 'y') { p.vel.x *= 0.75; p.vel.z *= 0.75; if (Math.abs(p.vel.y) < 1.5) p.vel.y = 0; }
        }
    }
}



// ---------- NEW GADGETS: fire, sentry turret, melee, airstrike ----------
const _fireGeo = new THREE.CircleGeometry(1, 24); _fireGeo.rotateX(-Math.PI / 2);
function makeFire(x, y, z, sec) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6a1f, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(_fireGeo, mat); mesh.position.set(x, y + 0.05, z); mesh.scale.setScalar(sec.radius);
    scene.add(mesh);
    fires.push({ mesh, x, y, z, r: sec.radius, dps: sec.damage, t: 6, tick: 0 });
    sfx('fire'); spawnParticles(new V3(x, y + 0.5, z), 0xffa24d, 16, 7, 0.6, 0.18);
}
function updateFires(dt) {
    for (let i = fires.length - 1; i >= 0; i--) {
        const f = fires[i]; f.t -= dt; f.tick -= dt;
        f.mesh.material.opacity = 0.35 + 0.2 * Math.sin(gameTime * 18 + i) * Math.min(1, f.t);
        if (Math.random() < 0.8) spawnParticles(new V3(f.x + (Math.random() - 0.5) * f.r * 1.4, f.y + 0.2, f.z + (Math.random() - 0.5) * f.r * 1.4), Math.random() < 0.5 ? 0xff8a1f : 0xffd24d, 1, 2, 0.6, 0.18, false, { grav: -6 });
        if (f.tick <= 0) {
            f.tick = 0.25;
            for (const e of [...enemies]) {
                const u = e.userData;
                if (!u.dead && Math.hypot(e.position.x - f.x, e.position.z - f.z) < f.r + u.radius && Math.abs(e.position.y - f.y) < 1.5) damageEnemy(e, f.dps * 0.25 * (powerOn('dmg') ? 2 : 1) * clsDmg(), false, null, true, null, 1, 'molotov');
            }
        }
        if (f.t <= 0) { scene.remove(f.mesh); f.mesh.material.dispose(); fires.splice(i, 1); }
    }
}


const _turretMat = new THREE.MeshStandardMaterial({ color: 0x7b8798, roughness: 0.45, metalness: 0.35 });
const _turretDark = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.55, metalness: 0.3 });
const _turretGold = new THREE.MeshStandardMaterial({ color: 0xf0b832, roughness: 0.32, metalness: 0.65, emissive: 0x6a4300, emissiveIntensity: 0.5 });
const _turretPlasma = new THREE.MeshStandardMaterial({ color: 0x2a2140, roughness: 0.25, metalness: 0.5, emissive: 0x1c0f33, emissiveIntensity: 1 });
const _turretAcc = new THREE.MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false });
const _turretCore = new THREE.MeshBasicMaterial({ color: 0xc084fc, toneMapped: false });
const _turretAccMini = new THREE.MeshBasicMaterial({ color: 0xfacc15, toneMapped: false });
// Each upgrade level adds visible hardware: armor, radar, quad guns, rocket pods, plasma core.
// mini = the Engineer's Field Kit sentry (4.0): its own stats, a smaller model with amber lights, never uses the Q cooldown.
function deployTurret(x, y, z, mini = null) {
    const L = mini ? (mini.hard ? 1 : 0) : (playerStats.upgrades.turret || 0), st = mini || turretStats(L);
    const body = mini ? _turretMat : L >= 5 ? _turretPlasma : (L >= 4 ? _turretGold : _turretMat), acc = mini ? _turretAccMini : L >= 5 ? _turretCore : _turretAcc;
    const g = new THREE.Group(); g.position.set(x, y, z);
    if (mini) g.scale.setScalar(0.72);
    const B = (p, sx, sy, sz, m, px, py, pz) => { const o = new THREE.Mesh(sharedBox, m); o.scale.set(sx, sy, sz); o.position.set(px, py, pz); o.castShadow = true; p.add(o); return o; };
    const h = L >= 5 ? 0.35 : 0;
    B(g, 1.2, 0.3, 1.2, _turretDark, 0, 0.15, 0);
    for (const [lx, lz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) B(g, 0.2, 0.2, 0.2, body, lx, 0.1, lz);
    B(g, 0.3, 0.9 + h, 0.3, body, 0, 0.75 + h / 2, 0);
    const head = new THREE.Group(); head.position.y = 1.3 + h; g.add(head);
    B(head, 0.7, 0.45, 0.8, body, 0, 0, 0);
    B(head, 0.72, 0.1, 0.5, acc, 0, 0.1, 0);
    const guns = L >= 3 ? [[0.14, 0.08], [-0.14, 0.08], [0.14, -0.08], [-0.14, -0.08]] : [[0.14, 0], [-0.14, 0]];
    for (const [gx, gy] of guns) { B(head, 0.1, 0.1, 0.85, _turretDark, gx, gy, 0.6); B(head, 0.13, 0.13, 0.1, acc, gx, gy, 1.02); }
    if (L >= 1) { B(head, 0.08, 0.5, 0.7, body, 0.42, 0, 0.05); B(head, 0.08, 0.5, 0.7, body, -0.42, 0, 0.05); B(head, 0.74, 0.08, 0.3, _turretDark, 0, -0.22, 0.42); }
    let radar = null;
    if (L >= 2) {
        B(head, 0.06, 0.35, 0.06, _turretDark, 0, 0.4, -0.25);
        radar = new THREE.Group(); radar.position.set(0, 0.6, -0.25); head.add(radar);
        B(radar, 0.5, 0.3, 0.05, body, 0, 0, 0); B(radar, 0.1, 0.1, 0.1, acc, 0, 0, 0.06);
    }
    let pods = [];
    if (mini ? mini.rockets : L >= 4) for (const sx of [-0.6, 0.6]) {
        const pod = B(head, 0.3, 0.32, 0.5, _turretDark, sx, 0.05, 0.1); pods.push(pod);
        for (const [ox, oy] of [[-0.07, 0.07], [0.07, 0.07], [-0.07, -0.07], [0.07, -0.07]]) B(head, 0.08, 0.08, 0.04, acc, sx + ox, 0.05 + oy, 0.36);
    }
    let core = null;
    if (L >= 5) { core = B(g, 0.42, 0.42, 0.42, _turretCore, 0, 0.9, 0); core.castShadow = false; }
    const ring = new THREE.Mesh(_auraGeo, new THREE.MeshBasicMaterial({ color: mini ? 0xfacc15 : L >= 5 ? 0xc084fc : 0x38bdf8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.scale.setScalar(1.2); ring.position.y = 0.05; g.add(ring);
    scene.add(g);
    turrets.push({ g, head, ring, radar, core, t: st.life, cd: 0, rocketCd: 1, st, target: null, side: 1, gi: 0, guns, L, hp: st.hp, ammo: st.ammo, hurt: 0, mini: !!mini, s: mini ? 0.72 : 1 });
    spawnParticles(new V3(x, y + 0.5, z), mini ? 0xfacc15 : L >= 5 ? 0xc084fc : 0x38bdf8, 14, 5, 0.5, 0.1);
}
// the Q Sentry Turret (not the Engineer's mini sentry) if it's deployed
function mainTurret() { for (const t of turrets) if (!t.mini) return t; return null; }
function miniTurret() { for (const t of turrets) if (t.mini) return t; return null; }
const _tp = new V3(), _tq = new V3();
function updateTurrets(dt) {
    for (let i = turrets.length - 1; i >= 0; i--) {
        const t = turrets[i], st = t.st; t.t -= dt; t.cd -= dt; t.rocketCd -= dt; t.hurt -= dt;
        // the ring shows its health: blue -> red, blinking when it's about to go
        const hpF = Math.max(0, t.hp / st.hp), dying = t.t < 3 || hpF < 0.25 || t.ammo <= 0;
        if (t.mini) t.ring.material.color.setRGB(1, lerp(0.2, 0.8, hpF), lerp(0.2, 0.08, hpF));
        else t.ring.material.color.setRGB(lerp(1, t.L >= 5 ? 0.75 : 0.22, hpF), lerp(0.2, t.L >= 5 ? 0.52 : 0.74, hpF), lerp(0.2, 0.98, hpF));
        t.ring.material.opacity = dying ? (Math.floor(gameTime * 6) % 2 ? 0.6 : 0.08) : (t.hurt > 0 ? 0.7 : 0.3);
        if (t.radar) t.radar.rotation.y += dt * 3;
        if (t.core) { t.core.rotation.y += dt * 2; t.core.rotation.x += dt; t.core.scale.setScalar(0.42 * (1 + Math.sin(gameTime * 6) * 0.12)); }
        t.head.getWorldPosition(_tp);
        // nearest enemy it can actually see
        if (!t.target || t.target.userData.dead || t.cd < -0.5) {
            t.target = null; let bd = st.range;
            for (const e of enemies) {
                const u = e.userData; if (u.dead) continue;
                const d = _tp.distanceTo(e.position);
                if (d < bd && losClear(_tp.x, _tp.y, _tp.z, e.position.x, e.position.y + u.totalHeight * 0.55, e.position.z)) { bd = d; t.target = e; }
            }
        }
        if (t.target && t.ammo > 0) {
            const e = t.target, u = e.userData;
            _tq.set(e.position.x, e.position.y + u.totalHeight * 0.55, e.position.z);
            const want = Math.atan2(_tq.x - _tp.x, _tq.z - _tp.z);
            let dA = want - t.head.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
            t.head.rotation.y += clamp(dA, -dt * 9, dt * 9);
            if (Math.abs(dA) < 0.2 && t.cd <= 0) {
                t.cd = st.delay; t.gi = (t.gi + 1) % t.guns.length; t.ammo--;
                const [gx, gy] = t.guns[t.gi];
                const from = _tp.clone().add(new V3((Math.sin(want) * 1.0 + Math.cos(want) * gx) * t.s, gy * t.s, (Math.cos(want) * 1.0 - Math.sin(want) * gx) * t.s));
                // it isn't a perfect aimbot any more: some rounds miss, more at long range
                const hit = Math.random() < st.aim - _tp.distanceTo(_tq) / st.range * 0.25;
                if (!hit) _tq.add(_tmp.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(2.2));
                spawnTracer(from, _tq, t.mini ? 0xfde68a : t.L >= 5 ? 0xd8b4fe : 0x7dd3fc, 0.03, 0.07);
                spawnParticles(from, 0xbfe9ff, 2, 3, 0.1, 0.06);
                if (hit) damageEnemy(e, st.damage * (powerOn('dmg') ? 2 : 1), false, null, true, null, 1, 'turret');
                if (Math.random() < 0.5) sfx('turret');
                if (t.ammo === 0) toast(t.mini ? 'MINI SENTRY OUT OF AMMO' : 'SENTRY OUT OF AMMO', t.mini ? '#fde047' : '#7dd3fc', 1.4);
            }
            if (st.rockets && t.rocketCd <= 0 && Math.abs(dA) < 0.3) {
                t.rocketCd = st.rockets;
                const mesh = new THREE.Mesh(_shellGeo, _shellMat); mesh.position.copy(_tp).add(new V3(0, 0.1, 0));
                scene.add(mesh);
                const v = _tq.clone().sub(mesh.position).normalize().multiplyScalar(38);
                projectiles.push({ kind: 'shell', mesh, vel: v.add(new V3(0, 1.5, 0)), fuse: 2.5, sec: { damage: st.rocketDmg || 60 + 15 * (t.L - 4), radius: 4 }, trail: 0, noSelf: true });
                sfx('thump');
            }
        }
        if (t.ammo <= 0) t.t = Math.min(t.t, 1.2);          // powers down a moment after the belt runs dry
        if (t.t <= 0 || t.hp <= 0) removeTurret(t, t.hp <= 0);
    }
}


// one sentry at a time; its cooldown only starts once it's gone
function removeTurret(t, destroyed) {
    const i = turrets.indexOf(t); if (i < 0) return;
    t.head.getWorldPosition(_tp);
    scene.remove(t.g); t.ring.material.dispose(); turrets.splice(i, 1);
    spawnParticles(_tp, 0x94a3b8, 10, 5, 0.8, 0.2, true, { bounce: true });
    if (destroyed) { spawnBlastFx(_tp, 3, t.mini ? 0xfacc15 : 0x7dd3fc, false, 0.5); spawnParticles(_tp, 0xffc266, 12, 9, 0.5, 0.12); sfx('boom'); toast(t.mini ? 'MINI SENTRY DESTROYED' : 'SENTRY DESTROYED', '#fca5a5', 1.4); }
    if (!t.mini) turretCd = t.st.cooldown;     // the Engineer's mini sentry runs on the class ability cooldown instead
    updateHUD();
}
// an enemy bashing the sentry
function hitTurret(t, u, cfg) {
    if (u.attackCooldown > 0) return;
    u.attackCooldown = 1.1; u.armSwing = 0.3;
    t.hp -= cfg.damage * 2.2; t.hurt = 0.15;
    t.head.getWorldPosition(_tp);
    spawnParticles(_tp, 0xbfe9ff, 5, 4, 0.3, 0.08);
    sfx('thud');
}
// nearest live sentry this enemy should go for (only if it's closer than you)
function pickDecoy(enemy) {
    let best = null, bd = 1e9;
    const dp = Math.hypot(camera.position.x - enemy.position.x, camera.position.z - enemy.position.z);
    for (const t of turrets) {
        if (t.hp <= 0 || t.ammo <= 0) continue;
        const d = Math.hypot(t.g.position.x - enemy.position.x, t.g.position.z - enemy.position.z);
        if (d < t.st.aggro && d < dp && d < bd && Math.abs(t.g.position.y - enemy.position.y) < 3) { bd = d; best = t; }
    }
    return best;
}


// Quick melee: shove the gun forward into whatever is in front of you
function melee() {
    if (currentGameState !== 'playing' || meleeCd > 0 || currentHp <= 0) return;
    meleeCd = 0.75; vm.melee = 0.4; vm.inspect = 0;
    sfx('whoosh');
    camera.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
    let best = null, bd = 3.4;
    for (const e of enemies) {
        const u = e.userData; if (u.dead) continue;
        const dx = e.position.x - camera.position.x, dz = e.position.z - camera.position.z, d = Math.hypot(dx, dz) - u.radius;
        if (d > bd || Math.abs(feetY - e.position.y) > 2.5) continue;
        if ((dx * _fwd.x + dz * _fwd.z) / (Math.hypot(dx, dz) || 1) < 0.55) continue;   // must be in front
        bd = d; best = e;
    }
    if (best) {
        setTimeout(() => {
            if (best.userData.dead || currentGameState !== 'playing') return;
            const u = best.userData;
            const pt = new V3(best.position.x, best.position.y + u.totalHeight * 0.55, best.position.z);
            u.knock.addScaledVector(_fwd, 16 / Math.max(0.8, u.config.scale));
            if (u.state === 'aim' || u.state === 'windup') { u.state = 'walk'; u.aiT = 1.5; if (u.laser) u.laser.visible = false; }   // interrupts attacks
            damageEnemy(best, 70 * (powerOn('dmg') ? 2 : 1) * clsDmg(), false, pt, false, null, 1, 'melee');
            spawnParticles(pt, 0xffffff, 6, 5, 0.3, 0.08);
            sfx('melee'); shake = Math.max(shake, 0.18);
        }, 110);
    }
}


// Killstreak reward: an airstrike walks a line of bombs toward where you're looking
function callAirstrike() {
    if (currentGameState !== 'playing' || currentHp <= 0) return;
    if (strikeCharges <= 0) { toast(`Airstrike needs a ${STREAK_FOR_STRIKE}-kill streak (no damage taken)`, '#9ca3af', 1.4); sfx('deny'); return; }
    camera.getWorldDirection(_dir);
    const hit = raySolids(camera.position, _dir, 120);
    const target = hit ? hit.point.clone() : camera.position.clone().addScaledVector(_dir, 60);
    target.y = groundAt(target.x, target.z, 0, 50);
    if (target.y < -50) target.y = hit ? hit.point.y : feetY;        // aimed out over the sky
    if (Math.hypot(target.x - camera.position.x, target.z - camera.position.z) < 12) { toast('Too close! Aim farther away', '#fca5a5', 1.2); sfx('deny'); return; }
    strikeCharges--;
    chAdd('airstrike', 1);
    const flat = new V3(_dir.x, 0, _dir.z).normalize();
    const marker = new THREE.Mesh(_auraGeo, new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    marker.position.set(target.x, target.y + 0.08, target.z); marker.scale.setScalar(6); scene.add(marker);
    strikes.push({ marker, target, flat, t: 1.6, bombs: 0, next: 0 });
    sfx('strike'); sfx('whistle');
    toast('AIRSTRIKE INBOUND', '#fca5a5', 1.6);
    updateHUD();
}
function updateStrikes(dt) {
    for (let i = strikes.length - 1; i >= 0; i--) {
        const s = strikes[i]; s.t -= dt;
        s.marker.material.opacity = 0.4 + 0.4 * Math.sin(gameTime * 20);
        if (s.t <= 0) {
            s.next -= dt;
            if (s.next <= 0 && s.bombs < 7) {
                s.next = 0.12;
                const p = s.target.clone().addScaledVector(s.flat, (s.bombs - 3) * 5);
                p.x = clamp(p.x, -ARENA + 3, ARENA - 3); p.z = clamp(p.z, -ARENA + 3, ARENA - 3);
                p.y = groundAt(p.x, p.z, 0, 50) + 0.5; if (p.y < -50) p.y = s.target.y + 0.5;
                explode(p, 200, 7.5, { src: 'airstrike' });
                s.bombs++;
            }
            if (s.bombs >= 7) { scene.remove(s.marker); s.marker.material.dispose(); strikes.splice(i, 1); }
        }
    }
}
// ---------- RPG ----------
const _rocketGeo = new THREE.ConeGeometry(0.12, 0.6, 10); _rocketGeo.rotateX(Math.PI / 2);
const _rocketMat = new THREE.MeshStandardMaterial({ color: 0x4d5a2b, roughness: 0.6, emissive: 0xff7a1a, emissiveIntensity: 0.25 });
function fireRocket(w, dmgMul, spread) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    _dir.copy(_fwd).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize();
    const mesh = new THREE.Mesh(_rocketGeo, _rocketMat);
    mesh.position.copy(_muzzleW).addScaledVector(_dir, 0.4);
    scene.add(mesh);
    const L = w.level || 0;
    projectiles.push({ kind: 'rocket', mesh, vel: _dir.clone().multiplyScalar(72), fuse: 5, trail: 0, damage: w.damage * dmgMul, radius: w.radius + 0.4 * L });
    // backblast behind you
    const back = camera.position.clone().addScaledVector(_fwd, -1.2);
    spawnParticles(back, 0xbfbfbf, 10, 5, 0.8, 0.3, true, { grav: 0, drag: 3 });
    spawnParticles(_muzzleW, 0xffc266, 8, 6, 0.3, 0.12);
    shake = Math.max(shake, 0.25);
    sfx('rpg');
}


// ---------- LANDMINES ----------
let mines = [];
const _mineGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.12, 14), _mineTopGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12);
const _mineMat = new THREE.MeshStandardMaterial({ color: 0x3f4a2a, roughness: 0.7, metalness: 0.3 });
const _mineLed = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
function placeMine(sec) {
    const p = camera.position;
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion); _fwd.y = 0; _fwd.normalize();
    const x = p.x + _fwd.x * 1.2, z = p.z + _fwd.z * 1.2, y = Math.max(groundAt(x, z, 0.3, feetY + 0.5), feetY - 0.01 - (VOID ? 0 : 99));
    const g = new THREE.Group(); g.position.set(x, y, z);
    const base = new THREE.Mesh(_mineGeo, _mineMat); base.position.y = 0.06; base.castShadow = true; g.add(base);
    const top = new THREE.Mesh(_mineTopGeo, _mineMat); top.position.y = 0.14; g.add(top);
    const led = new THREE.Mesh(sharedBox, _mineLed); led.scale.setScalar(0.07); led.position.set(0.22, 0.14, 0); g.add(led);
    scene.add(g);
    mines.push({ g, led, x, y, z, arm: 1, sec });
    if (mines.length > 3) { const old = mines.shift(); scene.remove(old.g); }
    sfx('mine');
}
function updateMines(dt) {
    for (let i = mines.length - 1; i >= 0; i--) {
        const m = mines[i];
        m.arm -= dt;
        m.led.visible = m.arm > 0 ? true : (gameTime % 0.8) < 0.12;
        if (m.arm > 0) continue;
        for (const e of enemies) {
            const u = e.userData;
            if (u.dead || Math.abs(e.position.y - m.y) > 2) continue;
            if (Math.hypot(e.position.x - m.x, e.position.z - m.z) < u.radius + 1.6) {
                scene.remove(m.g); mines.splice(i, 1);
                explode(new V3(m.x, m.y + 0.4, m.z), m.sec.damage * (powerOn('dmg') ? 2 : 1), m.sec.radius, { src: 'landmine', color: 0xffb020 });
                break;
            }
        }
    }
}


function clearGadgets() {
    mines.forEach(m => scene.remove(m.g)); mines = [];
    turrets.forEach(t => { scene.remove(t.g); t.ring.material.dispose(); }); turrets = [];
    fires.forEach(f => { scene.remove(f.mesh); f.mesh.material.dispose(); }); fires = [];
    strikes.forEach(s => { scene.remove(s.marker); s.marker.material.dispose(); }); strikes = [];
    clearBossFx();
    clearClassFx();
}
