// ---------- 4.0 CLASS ABILITIES (X) ----------
// ASSAULT Adrenaline, MEDIC Healing Field, ENGINEER Field Kit (mini sentry + ammo crate), RECON Radar Pulse.
// Multiplayer: the Healing Field heals teammates and Recon's UPLINK shares marks (both ride the existing 'fx' relay, and
// each computer only ever heals / marks for its own player). Everything else is local to your own computer: Adrenaline,
// the Engineer's mini sentry and crate (teammates don't see them; the sentry isn't a decoy on the host) and your marks.
const adrenOn = () => abilityT > 0 && myClass() === 'assault';
const clsDmg = () => adrenOn() ? (clsUp('assault', 2) ? 1.5 : 1.25) : 1;       // your damage multiplier from the class
const abilityCooldown = (id = myClass()) => CLASSES[id] ? CLASSES[id].cd[Math.min(3, clsLvl(id))] : 1;
const gadgetMul = () => myClass() === 'engineer' ? 0.75 : 1;                      // ENGINEER passive: cheaper gadgets
const secCost = (sec) => Math.round(sec.cost * gadgetMul() / 10) * 10;
const _clsP = new V3(), _clsD = new V3();
let beatT = 0, healTick = 0, healingNow = 0, radarScan = 0, clsWas = null, fxBeat = 0, abilReadyWas = true;
function useAbility() {
    if (currentGameState !== 'playing' || currentHp <= 0 || NET.dead) return;
    const id = myClass();
    if (!id) { toast('Class abilities are off in PvP', '#9ca3af', 1.2); sfx('deny'); return; }
    const C = CLASSES[id];
    if (abilityCd > 0) { toast(`${C.ability} RECHARGING - ${Math.ceil(abilityCd)}s`, '#9ca3af', 1); sfx('deny'); return; }
    const ok = id === 'assault' ? adrenaline() : id === 'medic' ? healingField() : id === 'engineer' ? fieldKit() : radarPulse();
    if (!ok) return;
    abilityCd = abilityCooldown(id);
    updateAbilityHUD();
    chAdd('ability', 1);
}
// ASSAULT: every gun topped up on the spot, then faster and harder-hitting for a few seconds
function adrenaline() {
    abilityDur = abilityT = clsUp('assault', 1) ? 8 : 6;
    cancelReload(); burstLeft = 0;
    for (const w of playerStats.weapons) ammoState[w] = W(w).magSize;
    if (clsUp('assault', 1)) currentHp = Math.min(maxHp, currentHp + 30);
    beatT = 0.35; fxBeat = 1;
    sfx('adren'); screenFlash('rgba(249,115,22,0.4)'); shake = Math.max(shake, 0.25);
    spawnBlastFx(_clsP.set(camera.position.x, feetY + 0.3, camera.position.z), 6, 0xff7a1a, true, 0.5);
    toast(clsUp('assault', 3) ? 'ADRENALINE!  UNSTOPPABLE' : 'ADRENALINE!', '#fb923c', 1.4);
    updateHUD();
    return true;
}
// MEDIC: a glowing ring on the ground that heals everyone standing in it
function healStats() { return { r: clsUp('medic', 1) ? 9 : 6, d: clsUp('medic', 1) ? 12 : 8, h: clsUp('medic', 3) ? 14 : 8, a: clsUp('medic', 2) ? 6 : 0 }; }
function healingField() {
    const s = healStats(), x = camera.position.x, z = camera.position.z;
    let y = groundAt(x, z, 0.3, feetY + 0.5); if (y < feetY - 6) y = feetY;
    addHealField(x, y, z, s.r, s.d, s.h, s.a, true);
    abilityDur = abilityT = s.d;
    if (NET.inGame) netSendFx('heal', _clsP.set(x, y, z), s.r, 0x4ade80, { d: s.d, h: s.h, a: s.a });
    sfx('field'); screenFlash('rgba(74,222,128,0.3)');
    toast('HEALING FIELD', '#4ade80', 1.4);
    return true;
}
const _hfOpts = { grav: -3.5, drag: 1.2 };
function addHealField(x, y, z, r, d, h, a, own) {
    if (own) for (const f of healFields) if (f.own) f.t = Math.min(f.t, 0.4);      // one of yours at a time: the old one fades
    if (healFields.length >= 6) removeHealField(0);
    const disc = new THREE.Mesh(_fireGeo, fxMat(0x22c55e, 0.15)); disc.position.set(x, y + 0.05, z); disc.scale.setScalar(r);
    const ring = new THREE.Mesh(_bRingGeo, fxMat(0x4ade80, 0.85)); ring.position.set(x, y + 0.07, z); ring.scale.setScalar(r);
    const wall = new THREE.Mesh(_bWaveGeo, fxMat(0x4ade80, 0.1)); wall.position.set(x, y, z); wall.scale.set(r, 2.2, r);
    const plusMat = new THREE.MeshBasicMaterial({ color: 0x86efac, toneMapped: false });
    const plus = new THREE.Group(); plus.position.set(x, y + 2.7, z);
    for (const [sx, sy] of [[0.7, 0.22], [0.22, 0.7]]) { const m = new THREE.Mesh(sharedBox, plusMat); m.scale.set(sx, sy, 0.12); plus.add(m); }
    scene.add(disc, ring, wall, plus);
    healFields.push({ x, y, z, r, t: d, T: d, h, a, own, disc, ring, wall, plus, plusMat, pt: 0 });
    spawnParticles(_clsP.set(x, y + 0.4, z), 0x4ade80, 16, 6, 0.6, 0.14, false, { jitter: r * 0.8, grav: -2 });
}
function removeHealField(i) {
    const f = healFields[i];
    for (const m of [f.disc, f.ring, f.wall]) { scene.remove(m); m.material.dispose(); }
    scene.remove(f.plus); f.plusMat.dispose();
    healFields.splice(i, 1);
}
function updateHealFields(dt) {
    let heal = 0, arm = 0;
    for (let i = healFields.length - 1; i >= 0; i--) {
        const f = healFields[i]; f.t -= dt;
        if (f.t <= 0) { removeHealField(i); continue; }
        const fade = Math.min(1, f.t / 0.5), grow = Math.min(1, (f.T - f.t) / 0.35), pulse = 0.5 + 0.5 * Math.sin(gameTime * 5 + i);
        f.ring.scale.setScalar(f.r * (0.3 + 0.7 * grow)); f.disc.scale.setScalar(f.r * (0.3 + 0.7 * grow));
        f.ring.material.opacity = (0.55 + 0.35 * pulse) * fade;
        f.disc.material.opacity = (0.09 + 0.08 * pulse) * fade;
        f.wall.material.opacity = 0.09 * fade * grow;
        f.plus.rotation.y += dt * 2; f.plus.position.y = f.y + 2.7 + Math.sin(gameTime * 2.5 + i) * 0.15; f.plus.scale.setScalar(Math.max(0.01, fade * grow));
        f.pt -= dt;
        if (f.pt <= 0) {     // rising green sparkles
            f.pt = 0.07;
            const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * f.r;
            _clsP.set(f.x + Math.cos(a) * rr, f.y + 0.15, f.z + Math.sin(a) * rr);
            // not right under your nose: up close a sparkle fills half the screen
            if (Math.hypot(_clsP.x - camera.position.x, _clsP.z - camera.position.z) > 1.8) spawnParticles(_clsP, Math.random() < 0.5 ? 0x4ade80 : 0xbbf7d0, 1, 1.2, 1.1, 0.16, false, _hfOpts);
        }
        // every computer heals its own player when they stand in any field (fields don't stack: the strongest wins)
        if (currentHp > 0 && !NET.dead && Math.hypot(camera.position.x - f.x, camera.position.z - f.z) < f.r && Math.abs(feetY - f.y) < 3) { heal = Math.max(heal, f.h); arm = Math.max(arm, f.a); }
    }
    healingNow = heal;
    if (!heal) return;
    const before = currentHp;
    currentHp = Math.min(maxHp, currentHp + heal * dt);
    const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    if (arm && tier && currentArmor < tier.max) currentArmor = Math.min(tier.max, currentArmor + arm * dt);
    if ((healTick -= dt) <= 0 && currentHp > before) { healTick = 0.9; sfx('mend'); }
}
// ENGINEER: a small sentry plus an ammo crate
const _kitCrateMat = new THREE.MeshStandardMaterial({ color: 0x4d5a2b, roughness: 0.8, metalness: 0.1 });
const _kitCrateBand = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, emissive: 0x3a2a00 });
const _kitCrateGlow = new THREE.MeshBasicMaterial({ color: 0xfde047, toneMapped: false });
function miniSentryStats() {
    const hard = clsUp('engineer', 1);
    return { hard, damage: 7, hp: hard ? 240 : 150, ammo: hard ? 145 : 90, delay: 0.22, range: 22, cooldown: 0, life: hard ? 35 : 25, aim: 0.72, aggro: 12, rockets: clsUp('engineer', 3) ? 5 : 0, rocketDmg: 45 };
}
function fieldKit() {
    camera.getWorldDirection(_clsD); _clsD.y = 0; if (_clsD.lengthSq() < 1e-4) _clsD.set(0, 0, -1); _clsD.normalize();
    const px = camera.position.x, pz = camera.position.z;
    const sx = px + _clsD.x * 2.6, sz = pz + _clsD.z * 2.6, sy = groundAt(sx, sz, 0.3, feetY + 0.5);
    if (pointInSolid(_clsP.set(sx, feetY + 0.5, sz), 0.4) || sy < feetY - 3) { toast('No room to deploy here', '#9ca3af'); sfx('deny'); return false; }
    // the crate goes beside you (right, then left, then right where you're standing)
    let cx = px, cz = pz, cy = feetY;
    for (const side of [1, -1]) {
        const x = px + _clsD.x * 2.1 - _clsD.z * 1.7 * side, z = pz + _clsD.z * 2.1 + _clsD.x * 1.7 * side, y = groundAt(x, z, 0.3, feetY + 0.5);
        if (!pointInSolid(_clsP.set(x, feetY + 0.4, z), 0.35) && y >= feetY - 2) { cx = x; cz = z; cy = y; break; }
    }
    // a new kit replaces the old one
    for (let i = turrets.length - 1; i >= 0; i--) if (turrets[i].mini) removeTurret(turrets[i], false);
    while (crates.length) removeCrate(0);
    const st = miniSentryStats();
    deployTurret(sx, sy, sz, st);
    makeCrate(cx, cy, cz);
    abilityDur = abilityT = st.life;
    sfx('kit'); toast('FIELD KIT DEPLOYED', '#fde047', 1.4);
    return true;
}
function makeCrate(x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.atan2(_clsD.x, _clsD.z);
    const B = (p, sx, sy, sz, m, px, py, pz, sh = true) => { const o = new THREE.Mesh(sharedBox, m); o.scale.set(sx, sy, sz); o.position.set(px, py, pz); o.castShadow = sh; p.add(o); return o; };
    B(g, 0.95, 0.5, 0.62, _kitCrateMat, 0, 0.25, 0);
    B(g, 0.99, 0.08, 0.66, _turretDark, 0, 0.53, 0);
    B(g, 0.97, 0.11, 0.64, _kitCrateBand, 0, 0.3, 0);
    B(g, 0.12, 0.12, 0.02, _kitCrateGlow, 0.3, 0.3, 0.33, false);
    const icon = new THREE.Group(); icon.position.y = 1.2; g.add(icon);
    for (let i = -1; i <= 1; i++) { B(icon, 0.09, 0.28, 0.09, _kitCrateGlow, i * 0.16, 0, 0, false); B(icon, 0.055, 0.09, 0.055, _kitCrateGlow, i * 0.16, 0.18, 0, false); }
    const ring = new THREE.Mesh(_auraGeo, fxMat(0xfacc15, 0.4)); ring.scale.setScalar(1.9); ring.position.y = 0.05; g.add(ring);
    scene.add(g);
    const n = clsUp('engineer', 2) ? 5 : 3;
    crates.push({ g, icon, ring, x, y, z, n, t: 45, cd: 0.6, heal: clsUp('engineer', 2) ? 20 : 0 });
    spawnParticles(_clsP.set(x, y + 0.5, z), 0xfacc15, 10, 4, 0.5, 0.1);
}
function removeCrate(i, poof) {
    const c = crates[i];
    scene.remove(c.g); c.ring.material.dispose();
    if (poof) spawnParticles(_clsP.set(c.x, c.y + 0.4, c.z), 0x6b7a3a, 8, 4, 0.7, 0.18, true, { bounce: true });
    crates.splice(i, 1);
}
function needsResupply(c) {
    const id = playerStats.currentWeapon, tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    if (ammoState[id] < W(id).magSize || secondaryCooldown > 1) return true;
    for (const w of playerStats.weapons) if (ammoState[w] < W(w).magSize * 0.5) return true;
    return (tier && currentArmor < tier.max * 0.9) || (c.heal > 0 && currentHp < maxHp - 10);
}
function updateCrates(dt) {
    for (let i = crates.length - 1; i >= 0; i--) {
        const c = crates[i]; c.t -= dt; c.cd -= dt;
        c.icon.rotation.y += dt * 2.2; c.icon.position.y = 1.2 + Math.sin(gameTime * 3 + i) * 0.1;
        c.icon.visible = c.cd <= 0 && (c.t > 4 || Math.floor(gameTime * 6) % 2 === 0);
        c.ring.material.opacity = c.cd > 0 ? 0.1 : 0.28 + 0.14 * Math.sin(gameTime * 5);
        if (c.cd <= 0 && currentHp > 0 && !NET.dead && Math.hypot(camera.position.x - c.x, camera.position.z - c.z) < 1.9 && Math.abs(feetY - c.y) < 2.2 && needsResupply(c)) resupply(c);
        if (c.t <= 0 || c.n <= 0) removeCrate(i, true);
    }
}
// walk up to the crate: every mag full, gadgets recharged, some armor (and HP with MEDKIT CRATE)
function resupply(c) {
    c.n--; c.cd = 3;
    cancelReload(); burstLeft = 0;
    for (const w of playerStats.weapons) ammoState[w] = W(w).magSize;
    secondaryCooldown = 0; if (!mainTurret()) turretCd = 0;
    const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    if (tier) currentArmor = Math.min(tier.max, currentArmor + 25);
    if (c.heal) currentHp = Math.min(maxHp, currentHp + c.heal);
    sfx('resupply'); screenFlash('rgba(250,204,21,0.22)');
    spawnParticles(_clsP.set(c.x, c.y + 0.8, c.z), 0xfde047, 10, 4, 0.5, 0.1);
    toast(c.n > 0 ? `RESUPPLIED  ·  ${c.n} LEFT` : 'RESUPPLIED  ·  CRATE EMPTY', '#fde047', 1.3);
    updateHUD();
}
// RECON: a sonar pulse that marks zombies (outlined through walls + on the minimap)
function radarStats() { return { r: clsUp('recon', 1) ? 999 : 70, d: clsUp('recon', 1) ? 9 : 6 }; }
function markEnemy(u, until) { if (!(u.markT >= until)) u.markT = until; if (until > markUntil) markUntil = until; }
function radarMark(x, z, r, d) {
    let n = 0; const until = gameTime + d;
    for (const e of enemies) {
        const u = e.userData; if (u.dead || Math.hypot(e.position.x - x, e.position.z - z) > r) continue;
        markEnemy(u, until); n++;
    }
    return n;
}
function radarPulse() {
    const s = radarStats();
    const n = radarMark(camera.position.x, camera.position.z, s.r, s.d);
    abilityDur = abilityT = radarT = s.d; radarScan = 0.5; radarSweep = 1;
    spawnBlastFx(_clsP.set(camera.position.x, feetY + 0.2, camera.position.z), Math.min(s.r, 80), 0xa78bfa, true, 1.2);
    if (NET.inGame && clsUp('recon', 3)) netSendFx('radar', _clsP.set(camera.position.x, feetY, camera.position.z), s.r, 0xa78bfa, { d: s.d });
    sfx('radar'); screenFlash('rgba(167,139,250,0.22)');
    toast(n ? `RADAR  ·  ${n} ZOMBIE${n > 1 ? 'S' : ''} MARKED` : 'RADAR  ·  ALL CLEAR', '#c4b5fd', 1.6);
    return true;
}
// a hit from you (RECON passive: marks it; WEAK SPOT: marked zombies take +15%). Returns the damage to apply.
function reconHit(u, amount) {
    if (myClass() !== 'recon') return amount;
    if (clsUp('recon', 2) && u.markT > gameTime) amount *= 1.15;
    markEnemy(u, gameTime + 3);
    return amount;
}
function clearClassFx() {
    while (healFields.length) removeHealField(0);
    while (crates.length) removeCrate(0);
    abilityT = 0; radarT = 0; radarSweep = 0; markUntil = -1; healingNow = 0;
}
// keep the health + armor bars live every frame (regeneration, healing fields, crates) - only does any work when a number changes
const hpShown = { hp: -1, max: -1, arm: -1, tier: '' };
function refreshHealthHUD(force) {
    const hp = Math.max(0, Math.ceil(currentHp));
    if (force || hp !== hpShown.hp || maxHp !== hpShown.max) {
        hpShown.hp = hp; hpShown.max = maxHp;
        setWidth(ui.healthBar, Math.max(0, (currentHp / maxHp) * 100));
        setText(ui.healthText, `${hp} / ${maxHp}`);
    }
    const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    if (!tier) return;
    const arm = Math.ceil(currentArmor);
    if (force || arm !== hpShown.arm || tier.id !== hpShown.tier) {
        hpShown.arm = arm; hpShown.tier = tier.id;
        setWidth(ui.armorBar, Math.max(0, currentArmor / tier.max * 100));
        setText(ui.armorText, `${tier.name.toUpperCase()}  ${arm} / ${tier.max}`);
    }
}
function updateClass(dt) {
    const id = myClass();
    if (id !== clsWas) { clsWas = id; applyMinimapSize(); }
    if (abilityCd > 0) abilityCd = Math.max(0, abilityCd - dt);
    // recharge chime (also when an Assault kill knocks the last second off)
    const ready = abilityCd <= 0;
    if (ready && !abilReadyWas && id && currentHp > 0) sfx('ready');
    abilReadyWas = ready;
    if (abilityT > 0) abilityT = Math.max(0, abilityT - dt);
    if (adrenOn()) { if ((beatT -= dt) <= 0) { beatT = 0.45; fxBeat = 1; sfx('beat'); } }
    if (radarT > 0) {
        radarT = Math.max(0, radarT - dt);
        // the pulse keeps sweeping while it lasts: zombies that wander into range get marked too
        if ((radarScan -= dt) <= 0 && radarT > 0) { radarScan = 0.5; radarMark(camera.position.x, camera.position.z, radarStats().r, radarT); }
    }
    if (radarSweep > 0) radarSweep = Math.max(0, radarSweep - dt / 1.4);
    updateHealFields(dt);
    updateCrates(dt);
    if (id === 'engineer') { const m = miniTurret(); abilityT = m ? Math.max(0, m.t) : 0; }
    refreshHealthHUD();
    updateAbilityHUD();
    updateClassFx(dt);
}
function updateAbilityHUD() {
    const id = myClass();
    const show = !!id && currentGameState !== 'main';
    if (ui.abil._on !== show) { ui.abil._on = show; ui.abil.classList.toggle('hidden', !show); }
    if (!show) return;
    const C = CLASSES[id], col = C.css;
    setText(ui.abilCls, C.name); setText(ui.abilName, C.ability); setStyle(ui.abilName, 'color', col);
    let status, pct, bar = col;
    const ready = abilityCd <= 0;
    if (ready) { status = 'READY  ·  PRESS X'; pct = 100; bar = '#4ade80'; }
    else if (abilityT > 0) {
        const kit = id === 'engineer' ? miniTurret() : null;
        status = kit ? `SENTRY ${Math.ceil(kit.t)}s  ·  ${kit.ammo} AMMO` : `ACTIVE  ${abilityT.toFixed(1)}s`;
        pct = abilityT / abilityDur * 100;
    } else { status = `RECHARGING  ${abilityCd.toFixed(1)}s`; pct = (1 - abilityCd / abilityCooldown(id)) * 100; bar = '#fbbf24'; }
    setText(ui.abilStatus, status); setWidth(ui.abilBar, clamp(pct, 0, 100)); setStyle(ui.abilBar, 'background', bar);
    if (ui.abil._r !== ready) { ui.abil._r = ready; ui.abil.classList.toggle('ready', ready); }
    setStyle(ui.abil, 'border-color', ready ? col : 'rgba(255,255,255,0.1)');
    setStyle(ui.abil, 'box-shadow', ready ? C.glow : 'none');
}
// class-coloured screen edge: Adrenaline heartbeat, standing in a Healing Field, the Radar sweep
function updateClassFx(dt) {
    fxBeat = Math.max(0, fxBeat - dt * 2.6);
    let op = 0, c = 'rgba(249,115,22,0.6)';
    if (adrenOn()) op = 0.45 + 0.4 * fxBeat;
    else if (healingNow > 0 && currentHp < maxHp) { op = 0.38; c = 'rgba(74,222,128,0.5)'; }
    else if (radarSweep > 0) { op = radarSweep * 0.7; c = 'rgba(167,139,250,0.55)'; }
    setStyle(ui.clsFx, '--cfx', c);
    setStyle(ui.clsFx, 'opacity', op.toFixed(2));
    const healing = healingNow > 0 && currentHp > 0;
    if (ui.healing._on !== healing) { ui.healing._on = healing; ui.healing.classList.toggle('hidden', !healing); }
    if (healing) setText(ui.healing, currentHp < maxHp ? `✚ HEALING  +${healingNow} HP/s` : '✚ HEALING FIELD  ·  FULL HEALTH');
    setStyle(ui.healthWrap, 'border-color', healing ? '#4ade80' : '#374151');
    setStyle(ui.healthWrap, 'box-shadow', healing ? '0 0 14px rgba(74,222,128,0.7)' : 'none');
}
// RECON passive: a bigger minimap (and the top-right HUD moves over to make room for it)
function applyMinimapSize() {
    const px = myClass() === 'recon' ? 260 : 200;
    if (ui.minimap.width === px) return;
    ui.minimap.width = ui.minimap.height = px;
    ui.txtMoney.parentElement.style.marginRight = (px + 20) + 'px';
    const feed = $('net-feed'); if (feed) feed.style.top = (px + 36) + 'px';
    if (worldBlocks.length) buildMinimapStatic();
}
