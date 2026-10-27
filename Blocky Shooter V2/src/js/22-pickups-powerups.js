// ---------- PICKUPS (health + cash drops) ----------
// Every enemy has its own drop chances (drops: [health chance, health, cash chance, cash] in enemyTypes).
// Tougher enemies drop more often and more. Bosses always drop $500 and a full heal.
const _pickMats = { health: new THREE.MeshBasicMaterial({ color: 0x4ade80, toneMapped: false }), cash: new THREE.MeshBasicMaterial({ color: 0xfacc15, toneMapped: false }),
                    full: new THREE.MeshBasicMaterial({ color: 0x86efac, toneMapped: false }), gold: new THREE.MeshBasicMaterial({ color: 0xffd700, toneMapped: false }) };
function dropLoot(u, pos) {
    const d = u.config.drops || [0.1, 15, 0.1, 20];
    if (u.config.boss) {
        spawnPickup(pos, 'health', 999, -1.2);
        spawnPickup(pos, 'cash', Math.round(500), 1.2);
        return;
    }
    // drop-table cash grows 5% every wave (compounding, capped at 4x) so money keeps up with the waves
    const cashMul = Math.min(4, Math.pow(1.05, playerStats.level - 1)) * DIFF().cash;
    const sc = 1 + 0.25 * perk('scav');
    if (Math.random() < d[0] * sc) spawnPickup(pos, 'health', d[1], -0.7);
    if (Math.random() < d[2] * sc) spawnPickup(pos, 'cash', Math.round(d[3] * cashMul * (twist && twist.cash || 1)), 0.7);
}
function spawnPickup(pos, kind, amount, offset = 0) {
    const g = new THREE.Group();
    const big = amount >= 200, k = big ? 1.9 : 0.85 + Math.min(1, amount / 60) * 0.5;
    if (kind === 'health') {
        const m = big ? _pickMats.full : _pickMats.health;
        const a = new THREE.Mesh(sharedBox, m); a.scale.set(0.6 * k, 0.2 * k, 0.2 * k); const b2 = new THREE.Mesh(sharedBox, m); b2.scale.set(0.2 * k, 0.6 * k, 0.2 * k); g.add(a, b2);
    } else {
        const a = new THREE.Mesh(sharedBox, big ? _pickMats.gold : _pickMats.cash); a.scale.setScalar(0.42 * k); a.rotation.set(0.6, 0, 0.6); g.add(a);
    }
    const x = pos.x + offset, z = pos.z;
    let gy = groundAt(x, z, 0, pos.y + 0.5); if (gy < pos.y - 6) gy = pos.y;
    g.position.set(x, gy + 0.9, z); g.userData.baseY = gy + 0.9;
    scene.add(g);
    pickups.push({ mesh: g, kind, amount, life: big ? 45 : 25 });
}
function updatePickups(dt) {
    const pp = camera.position;
    for (const p of [...pickups]) {
        p.life -= dt;
        p.mesh.rotation.y += dt * 2.5;
        p.mesh.position.y = p.mesh.userData.baseY + Math.sin(gameTime * 3 + p.mesh.position.x) * 0.15;
        p.mesh.visible = p.life > 5 || Math.floor(p.life * 6) % 2 === 0;
        const d = Math.hypot(p.mesh.position.x - pp.x, p.mesh.position.z - pp.z);
        const dy = Math.abs((feetY + 0.8) - p.mesh.position.y);
        if (d < 1.9 && dy < 2.2 && currentHp > 0) {
            if (p.kind === 'health') {
                if (currentHp >= maxHp) continue;
                const heal = Math.min(p.amount, maxHp - currentHp);
                currentHp += heal; toast(p.amount >= 200 ? 'FULL HEAL!' : `+${Math.round(heal)} HP`, '#4ade80', 1);
            } else {
                playerStats.money += p.amount; toast(`+$${p.amount}`, p.amount >= 200 ? '#ffd700' : '#facc15', 1.1);
            }
            sfx('pickup'); scene.remove(p.mesh); pickups = pickups.filter(x => x !== p); updateHUD();
        } else if (p.life <= 0) { scene.remove(p.mesh); pickups = pickups.filter(x => x !== p); }
    }
}


// ---------- THE CAGED RAM ----------
// Every map has a cage with a Charger locked inside (the classic blocky model). It can't get out, can't die,
// and pays you when you shoot it: $6 + $0.4 per wave a hit, headshots x1.5.
let cageRam = null;
const CAGE_PAY = 6, CAGE_PAY_WAVE = 0.4;
function placeCageRam(c) {
    if (cageRam) { scene.remove(cageRam.e); disposeEnemy(cageRam.e); cageRam = null; }
    if (!c) return;
    const e = createEnemy(enemyTypes.charger, { classic: true });
    e.position.set(c.x, 0, c.z);
    scene.add(e);
    cageRam = { e, c, tx: c.x, tz: c.z, t: 2, state: 'walk', stateT: 0, payT: 0, cdx: 0, cdz: 0, walk: 0 };
}
function updateCageRam(dt) {
    const R = cageRam; if (!R) return;
    const e = R.e, u = e.userData, c = R.c, lim = c.half - 1.2;
    if (u.flash > 0) { u.flash -= dt; if (u.flash <= 0) { u.mat.emissive.setHex(u.baseEmissive); u.mat.emissiveIntensity = u.baseEmissiveI; } }
    R.payT -= dt;
    let moving = false;
    if (R.state === 'walk') {
        R.t -= dt;
        const dx = R.tx - e.position.x, dz = R.tz - e.position.z, dl = Math.hypot(dx, dz);
        if (dl > 0.3) { e.position.x += dx / dl * 1.8 * dt; e.position.z += dz / dl * 1.8 * dt; e.rotation.y = Math.atan2(dx, dz); moving = true; }
        else if (R.t <= 0) {
            // every so often it paws the ground and slams into the bars
            if (Math.random() < 0.45) { R.state = 'windup'; R.stateT = 1.1; const a = Math.floor(Math.random() * 4) * Math.PI / 2; R.cdx = Math.sin(a); R.cdz = Math.cos(a); e.rotation.y = a; }
            else { R.tx = c.x + (Math.random() * 2 - 1) * lim; R.tz = c.z + (Math.random() * 2 - 1) * lim; R.t = 1 + Math.random() * 2; }
        }
    } else if (R.state === 'windup') {
        R.stateT -= dt; e.position.x += (Math.random() - 0.5) * 0.04;
        u.armL.rotation.x = u.armR.rotation.x = -2.4 + Math.sin(gameTime * 20) * 0.2;
        if (R.stateT <= 0) R.state = 'charge';
    } else if (R.state === 'charge') {
        e.position.x += R.cdx * 9 * dt; e.position.z += R.cdz * 9 * dt; moving = true;
        if (Math.abs(e.position.x - c.x) > lim || Math.abs(e.position.z - c.z) > lim) {
            R.state = 'stun'; R.stateT = 1.4;
            if (camera.position.distanceTo(e.position) < 30) { sfxAt('thud', camera.position.distanceTo(e.position)); }
            spawnParticles(new V3(e.position.x + R.cdx, 2, e.position.z + R.cdz), 0xfde047, 6, 4, 0.6, 0.1);
        }
    } else if (R.state === 'stun') {
        R.stateT -= dt; u.head.rotation.y = Math.sin(gameTime * 14) * 0.4;
        if (R.stateT <= 0) { u.head.rotation.y = 0; R.state = 'walk'; R.t = 1.5; R.tx = c.x; R.tz = c.z; }
    }
    e.position.x = clamp(e.position.x, c.x - lim, c.x + lim); e.position.z = clamp(e.position.z, c.z - lim, c.z + lim);
    R.walk += (moving ? (R.state === 'charge' ? 9 : 1.8) : 0) * dt * 1.3;
    const sw = Math.sin(R.walk) * (moving ? 0.7 : 0.08);
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    if (R.state === 'walk' || R.state === 'stun') { u.armL.rotation.x = -Math.PI / 2 + sw * 0.25; u.armR.rotation.x = -Math.PI / 2 - sw * 0.25; }
    if (R.state === 'walk') u.head.rotation.z = Math.sin(R.walk * 0.5) * 0.06;
    if (R.state === 'charge') u.armL.rotation.x = u.armR.rotation.x = 0.6;
}
// a bullet reached the ram (it has infinite health) -> cash
function cageRamHit(point, head) {
    const R = cageRam, u = R.e.userData;
    u.flash = 0.08; u.mat.emissive.setHex(0xffffff); u.mat.emissiveIntensity = 0.7;
    showHitMarker(head, false);
    if (R.payT > 0) return;
    R.payT = 0.12;                                    // up to ~8 payouts a second
    const pay = Math.round((CAGE_PAY + playerStats.level * CAGE_PAY_WAVE) * (head ? 1.5 : 1));
    playerStats.money += pay;
    spawnDamageNumber(point, `+$${pay}`, 'cash');
    sfx(head ? 'head' : 'hit');
    updateHUD();
}


// ---------- SUPPLY DROPS (ammo / health) ----------
const _crateMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.4 });
const _chuteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9, side: THREE.DoubleSide });
const _chuteGeo = new THREE.SphereGeometry(2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const _beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 140, 8, 1, true);
function scheduleSupply() {
    const L = playerStats.level;
    suppliesLeft = run.mode === 'rush' ? (L >= 6 ? 2 : 1) : (L >= 2 ? (L >= 10 ? 2 : 1) : 0);
    supplyTimer = suppliesLeft ? 14 + Math.random() * 18 : -1;
}
function spawnSupply() {
    const pp = camera.position;
    let x = 0, z = 0, ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
        const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 38;
        x = clamp(pp.x + Math.cos(a) * r, -ARENA + 10, ARENA - 10); z = clamp(pp.z + Math.sin(a) * r, -ARENA + 10, ARENA - 10);
        ok = !pointInSolid(new V3(x, 1, z), 2) && groundAt(x, z, 1.5, 100) === 0;
    }
    if (!ok) return;
    const kind = Math.random() < 0.5 ? 'ammo' : 'med';
    const pc = SUPPLY_KINDS[kind].color;
    const group = new THREE.Group();
    const crate = new THREE.Mesh(sharedBox, _crateMat); crate.scale.setScalar(1.4); crate.position.y = 0.7; crate.castShadow = true; group.add(crate);
    const band = new THREE.Mesh(sharedBox, new THREE.MeshBasicMaterial({ color: pc, toneMapped: false })); band.scale.set(1.46, 0.25, 1.46); band.position.y = 0.7; group.add(band);
    const chute = new THREE.Mesh(_chuteGeo, _chuteMat); chute.position.y = 5; chute.scale.set(1, 0.6, 1); group.add(chute);
    const beam = new THREE.Mesh(_beamGeo, new THREE.MeshBasicMaterial({ color: pc, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    beam.position.y = 70; group.add(beam);
    group.position.set(x, 70, z);
    scene.add(group);
    supplies.push({ group, chute, beam, band, kind, landed: false, life: 45, x, z });
    toast('SUPPLY DROP INBOUND - follow the beam', hex(pc), 2.2);
    sfx('supply');
}
function updateSupplies(dt) {
    if (supplyTimer > 0 && waveActive) { supplyTimer -= dt; if (supplyTimer <= 0) { spawnSupply(); suppliesLeft--; supplyTimer = suppliesLeft > 0 ? 25 + Math.random() * 15 : -1; } }
    for (const s of [...supplies]) {
        const g = s.group;
        if (!s.landed) {
            g.position.y -= 7 * dt;
            g.rotation.y += dt * 0.5;
            if (g.position.y <= 0) { g.position.y = 0; s.landed = true; s.chute.visible = false; sfx('thump'); spawnParticles(new V3(s.x, 0.3, s.z), 0x9ca3af, 12, 5, 0.8, 0.3, true, { grav: 4, drag: 2, jitter: 1.5 }); }
        } else s.life -= dt;
        s.beam.position.y = 70 - g.position.y;
        s.beam.material.opacity = 0.18 + 0.14 * Math.sin(gameTime * 4);
        const d = Math.hypot(camera.position.x - s.x, camera.position.z - s.z);
        if (d < 2.3 && Math.abs(feetY - g.position.y) < 2.5) { collectSupply(s); continue; }
        if (s.life <= 0) removeSupply(s);
    }
}
function removeSupply(s) { scene.remove(s.group); s.band.material.dispose(); s.beam.material.dispose(); supplies = supplies.filter(x => x !== s); }
function collectSupply(s) {
    removeSupply(s);
    const p = SUPPLY_KINDS[s.kind];
    sfx('power');
    screenFlash(`rgba(${(p.color >> 16) & 255},${(p.color >> 8) & 255},${p.color & 255},0.35)`);
    if (s.kind === 'med') {
        currentHp = maxHp;
        const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
        if (tier) currentArmor = tier.max;
        toast('MEDICAL SUPPLIES - health & armor', hex(p.color), 2);
    } else {
        WEAPON_ORDER.forEach(k => ammoState[k] = Math.max(ammoState[k], W(k).magSize));
        toast('AMMO RESUPPLY - all magazines full', hex(p.color), 2);
    }
    updateHUD();
}

function updateRegen(dt) {
    // REGENERATION upgrade: heal after a few seconds without getting hit
    // 4.0 MEDIC passive: regenerates on its own (2 HP/s, 4 with FIELD ARMOR) and REGENERATION kicks in after 3s instead of 4
    const medic = myClass() === 'medic', calm = gameTime - lastHurtT > (medic ? 3 : 4);
    if (perk('regen') && currentHp > 0 && currentHp < maxHp && calm) currentHp = Math.min(maxHp, currentHp + perk('regen') * dt);
    if (medic && currentHp > 0 && currentHp < maxHp && calm && !NET.dead) currentHp = Math.min(maxHp, currentHp + (clsUp('medic', 2) ? 4 : 2) * dt);
}
