// ---------- ANTI CAMPING ----------
// 1) Edges and corners are too safe (enemies can only come from one side). Hug one for 6s and far-away
//    enemies start flanking in close, and the next wave drops in around you instead of across the map.
// 2) Stay in the same spot (within CAMP_R) for a minute and extra enemies quietly start spawning near
//    you - more and more, faster and faster - until you move or die. No message, no sound.
// Runs on the host for every player in co-op.
const CAMP_R = 8, CAMP_TIME = 60, CAMP_MAX_ALIVE = 70;
const nearEdge = (p) => Math.abs(p.x) > ARENA * 0.66 || Math.abs(p.z) > ARENA * 0.66;
const campState = new Map();
function resetCampState() { campState.clear(); }
function flankIn(p) {
    const far = enemies.filter(e => !e.userData.dead && !e.userData.config.boss && !e.userData.config.fixed && Math.hypot(e.position.x - p.x, e.position.z - p.z) > Math.min(45, ARENA * 0.6))
                       .sort((a, b) => Math.hypot(b.position.x - p.x, b.position.z - p.z) - Math.hypot(a.position.x - p.x, a.position.z - p.z)).slice(0, 2);
    // drop them in on the open side (toward the middle of the arena)
    const toMid = Math.atan2(-p.z, -p.x);
    for (const e of far) {
        const a = toMid + (Math.random() - 0.5) * 1.8, r = 16 + Math.random() * 10;
        const x = clamp(p.x + Math.cos(a) * r, -ARENA + 8, ARENA - 8), z = clamp(p.z + Math.sin(a) * r, -ARENA + 8, ARENA - 8);
        spawnParticles(new V3(e.position.x, e.position.y + 1.5, e.position.z), zLook(e.userData.config).blood, 8, 5, 0.6, 0.15);
        const sp = VOID && navSpot(p.x, p.z, 14, 26);
        if (VOID && !sp) continue;
        if (sp) e.position.set(sp[0], sp[1] + 12, sp[2]); else e.position.set(x, groundAt(x, z, 0, 50) + 14, z);
        const u = e.userData; u.velocityY = 0; u.onGround = false; u.knock.set(0, 0, 0); u.leaping = false; u.state = 'walk';
        if (u.laser) u.laser.visible = false;
    }
    return far.length > 0;
}
// extra enemies for a camper: they walk in from 18-30m away, preferring spots on the ground
function campSpawn(p, n) {
    const alive = enemies.reduce((c, e) => c + (e.userData.dead ? 0 : 1), 0);
    n = Math.min(n, CAMP_MAX_ALIVE - alive); if (n <= 0) return;
    const level = playerStats.level, counts = {};
    enemies.forEach(e => { const id = e.userData.config.id; counts[id] = (counts[id] || 0) + 1; });
    for (let i = 0; i < n; i++) {
        let x = 0, z = 0, gy = 0;
        const vs = VOID && navSpot(p.x, p.z, 18, 30);
        if (vs) { x = vs[0]; gy = vs[1]; z = vs[2]; }
        else for (let t = 0; t < 12; t++) {
            const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 12;
            x = clamp(p.x + Math.cos(a) * r, -ARENA + 4, ARENA - 4); z = clamp(p.z + Math.sin(a) * r, -ARENA + 4, ARENA - 4);
            gy = groundAt(x, z, 0, 50);
            if (gy < 1.5 && Math.hypot(x - p.x, z - p.z) > 14) break;
        }
        const cfg = pickEnemyType(level, counts); counts[cfg.id] = (counts[cfg.id] || 0) + 1;
        const e = spawnEnemy(cfg, x, z, gy + 0.1, waveSpeed(level), waveReward(level) * 0.5);
        e.userData.noLoot = true;       // no free health or cash for sitting still
        if (cfg.id === 'hound') { spawnHoundPack(e, x, z, gy + 0.1, waveSpeed(level), waveReward(level) * 0.5); for (const m of enemies) if (m.userData.packN && !m.userData.dead && m.userData.packIdx > 0 && m.userData.config.id === 'hound') m.userData.noLoot = true; }
    }
}
function updateCornerPressure(dt) {
    if (!waveActive || run.mode === 'sandbox' || NET.pvp || (NET.inGame && !NET.host)) return;
    for (const t of aiTargets()) {
        if (t.camp) continue;
        let s = campState.get(t.id);
        if (!s) campState.set(t.id, s = { edgeT: 0, flankT: 0, warned: false, ax: t.pos.x, az: t.pos.z, stayT: 0, spawnT: 0, lvl: 0 });
        const p = t.pos;
        if (!t.alive) { s.edgeT = 0; s.stayT = 0; s.lvl = 0; s.ax = p.x; s.az = p.z; continue; }
        // edges + corners
        const edge = nearEdge(p);
        s.edgeT = edge ? s.edgeT + dt : Math.max(0, s.edgeT - dt * 2);
        if (s.edgeT === 0) s.warned = false;
        if (edge && s.edgeT >= 6 && (s.flankT -= dt) <= 0) {
            s.flankT = 7;
            if (flankIn(p) && !s.warned && t.local) { s.warned = true; toast('ENEMIES ARE FLANKING YOU!', '#fb923c', 2); sfx('growl'); }
        }
        // standing still
        if (Math.hypot(p.x - s.ax, p.z - s.az) > CAMP_R) { s.ax = p.x; s.az = p.z; s.stayT = 0; s.lvl = 0; s.spawnT = 0; continue; }
        s.stayT += dt;
        if (s.stayT >= CAMP_TIME && (s.spawnT -= dt) <= 0) {
            campSpawn(p, Math.min(2 + s.lvl, 6));
            s.spawnT = Math.max(2.5, 7 - s.lvl * 0.6); s.lvl++;
        }
    }
}


function spawnWave() {
    const camping = !NET.inGame && nearEdge(camera.position);
    waveHurt = false;
    enemies.forEach(e => { scene.remove(e); disposeEnemy(e); });
    enemies = [];
    const level = playerStats.level;
    const bossList = waveBosses(level), bossWave = bossList.length > 0;
    twist = (!NET.inGame && run.mode !== 'sandbox' && run.mode !== 'bossrush' && level >= 6 && !bossWave && Math.random() < 0.7) ? TWISTS[Object.keys(TWISTS)[(Math.random() * 5) | 0]] : null;
    const count = Math.min(Math.round((6 + level * 2) * DIFF().count * (twist && twist.count || 1) * (run.mode === 'bossrush' ? 0.35 : 1)), twist && twist.count ? 80 : 60);
    const pp = camera.position;
    const counts = {};
    const list = [];
    bossList.forEach(id => list.push(enemyTypes[id]));
    // a new enemy type always shows up on the wave it unlocks, so you actually meet it
    const fresh = Object.values(enemyTypes).filter(t => t.minLvl === level && t.intel);
    fresh.forEach(t => list.push(...(t.id === 'marksman' ? [t] : [t, t])));
    list.forEach(t => counts[t.id] = (counts[t.id] || 0) + 1);
    while (list.length < count) { const t = pickEnemyType(level, counts); counts[t.id] = (counts[t.id] || 0) + 1; list.push(t); }


    for (const eConf of list) {
        let x, z, tries = 0;
        if (camping) {   // edge/corner campers get the wave dropped in around them instead of across the map
            do { const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 28; x = clamp(pp.x + Math.cos(a) * r, -ARENA + 8, ARENA - 8); z = clamp(pp.z + Math.sin(a) * r, -ARENA + 8, ARENA - 8); tries++; }
            while ((Math.hypot(x - pp.x, z - pp.z) < 18 || inCage(x, z)) && tries < 50);
        } else {
            do { x = (Math.random() * 2 - 1) * (ARENA - 15); z = (Math.random() * 2 - 1) * (ARENA - 15); tries++; }
            while ((Math.hypot(x - pp.x, z - pp.z) < Math.min(35, ARENA * 0.5) || inCage(x, z)) && tries < 50);
        }
        let sy = 18 + Math.random() * 10;
        if (VOID) { const sp = navSpot(pp.x, pp.z, camping ? 18 : 24, 999) || navSpot(pp.x, pp.z, 10, 999) || navSpot(pp.x, pp.z, 0, 999); if (sp) { x = sp[0]; z = sp[2]; sy = sp[1] + 10 + Math.random() * 8; } }
        const ne = spawnEnemy(eConf, x, z, sy, waveSpeed(level), waveReward(level));   // drop them in from the sky
        if (eConf.id === 'hound') spawnHoundPack(ne, x, z, sy, waveSpeed(level), waveReward(level));
        if (twist) { if (twist.hp && !eConf.boss) { ne.userData.hp *= twist.hp; ne.userData.maxHp = ne.userData.hp; } if (twist.speed) ne.userData.speed *= twist.speed; }
    }
    waveActive = true;
    if (NET.inGame) netWaveStarted(level);
    sfx('wave');
    toast(bossWave ? `WAVE ${level} - BOSS INCOMING` : (level === 1 ? `WAVE 1  \u00b7  ARENA: ${theme.name}` : twist ? `WAVE ${level}  \u00b7  ${twist.name}` : `WAVE ${level}`), bossWave ? '#e879f9' : (twist ? twist.color : '#ffffff'), 2.2);
    const twistHtml = twist ? `<div class="text-sm font-black hud-text" style="color:${twist.color}">WAVE TWIST: ${twist.name}</div><div class="text-xs text-gray-200 mb-1">${twist.desc}</div>` : '';
    const newTypes = [...new Set(list)].filter(t => t.intel && !seenTypes.has(t.id));
    newTypes.forEach(t => seenTypes.add(t.id));
    if (newTypes.length) showIntel(twistHtml + newTypes.map(t => `<div class="text-sm font-black hud-text" style="color:${hex(t.color === 0x3f4a5c ? 0x9fb1cc : t.color)}">NEW ENEMY: ${t.name.toUpperCase()}</div><div class="text-xs text-gray-200 mb-1">${t.intel}</div>`).join(''), 9);
    else if (twist) showIntel(twistHtml, 5);
    scheduleSupply();
    updateHUD();
}


function damageEnemy(enemyGroup, amount, isHeadshot, point, isExplosion = false, knockDir = null, pellets = 1, src = null) {
    const u = enemyGroup.userData;
    if (u.dead || u.hidden) return;
    // 3.9 boss rules: the Necromancer is untouchable while its Acolytes live, the Inferno shrugs off fire
    if (u.shielded || (u.config.fireImmune && (src === 'flamer' || src === 'molotov'))) {
        if (!dmgOwner && gameTime - (u.immT || -9) > 0.6) { u.immT = gameTime; spawnDamageNumber(point || new V3(enemyGroup.position.x, enemyGroup.position.y + u.totalHeight * 0.7, enemyGroup.position.z), u.shielded ? 'SHIELDED' : 'IMMUNE', 'boom'); sfx('thud'); }
        return;
    }
    if (!dmgOwner) amount = reconHit(u, amount);          // 4.0 RECON: your hits mark zombies (WEAK SPOT: marked ones take more)
    if (u.state === 'cloak') { u.state = 'walk'; u.aiT = 2.5; enemyGroup.visible = true; u.barShow = true; spawnDamageNumber(new V3(enemyGroup.position.x, enemyGroup.position.y + u.totalHeight, enemyGroup.position.z), 'REVEALED!', 'head'); }
    // multiplayer guest: tell the host (the referee) and show the hit right away so there's no lag
    if (NET.inGame && !NET.host) { netClientHit(enemyGroup, amount, isHeadshot, point, isExplosion, src || (isExplosion ? 'explosive' : playerStats.currentWeapon)); return; }
    if (u.config.armor && u.state !== 'stun' && !isExplosion) amount *= u.config.armor;     // the Juggernaut's plating
    if (u.linkUntil > gameTime && u.linkBy && !u.linkBy.userData.dead) amount *= 0.35;      // 5.0 Shocker: linked zombies take reduced damage until the Shocker dies
    const mine = !dmgOwner;              // host applying someone else's hit: no hit marker / numbers here
    if (mine) runStats.damage += Math.min(amount, Math.max(0, u.hp));
    u.hp -= amount;
    u.flash = 0.09;
    u.mat.emissive.setHex(0xffffff); u.mat.emissiveIntensity = 0.8;
    if (u.hitT <= 0.12 && amount > 0) { u.hitT = 0.24; u.hitHead = !!isHeadshot; u.hitSide = Math.random() < 0.5 ? 1 : -1; }      // flinch
    if (point && (isHeadshot || Math.random() < 0.6)) spawnParticles(point, isHeadshot ? 0xfff1a0 : 0xffffff, isHeadshot ? 6 : 3, 6, 0.2, 0.05, false, { grav: 10 });     // stylised, blood-free hit sparks
    u.barShow = true;
    if (knockDir) {
        const k = Math.min(16, 1.3 * pellets) / Math.max(0.8, u.config.scale * (u.config.boss ? 3 : 1));
        u.knock.x += knockDir.x * k; u.knock.z += knockDir.z * k;
    }
    const kill = u.hp <= 0;
    if (!isExplosion && mine) { showHitMarker(isHeadshot, kill); if (!kill) sfx(isHeadshot ? 'head' : 'hit'); }
    if (point && mine) spawnDamageNumber(point, Math.round(amount), isExplosion ? 'boom' : (isHeadshot ? 'head' : ''));
    if (kill) killEnemy(enemyGroup, false, isHeadshot && !isExplosion, src || (isExplosion ? 'explosive' : playerStats.currentWeapon));
}


function killEnemy(e, selfDestruct = false, headshot = false, src = 'explosive') {
    const u = e.userData;
    if (u.dead) return;
    u.dead = true;
    enemies = enemies.filter(x => x !== e);
    u.barShow = false; e.visible = true;
    if (u.laser) u.laser.visible = false;
    if (u.arcs) for (const m of u.arcs) m.visible = false;
    if (u.aura) u.aura.visible = false;
    if (u.bubble) u.bubble.visible = false;
    // a boss takes its helpers with it (Phantom decoys, the Necromancer's Acolytes)
    if (u.config.boss && (!NET.inGame || NET.host)) for (const o of [...enemies]) { const ou = o.userData; if (!ou.dead && (ou.master === e || (u.clones && u.clones.includes(o)))) { ou.noLoot = true; killEnemy(o, true); } }


    enemyById.delete(u.netId);
    const c = new V3(e.position.x, e.position.y + u.totalHeight * 0.5, e.position.z);
    if (NET.inGame && NET.host) netEnemyKilled(u.netId, selfDestruct ? -1 : dmgOwner, headshot, src);
    // rewards go to whoever got the kill (on their own computer)
    const award = !selfDestruct && !(NET.inGame && (dmgOwner || !NET.host));
    if (award) awardKill(u, c, headshot, src);
    if (u.config.ai === 'bomber') {
        scene.remove(e); disposeEnemy(e);
        spawnDebris(e);
        explode(c, (24 + playerStats.level * 2.2) * DIFF().dmg, 6.5, { hurtsPlayer: true, color: 0xff6a2a, fxOnly: NET.inGame && !NET.host, by: 'a Bomber explosion' });
    } else {
        if (headshot) { u.head.visible = false; spawnParticles(new V3(e.position.x, e.position.y + 2.8 * u.config.scale, e.position.z), zLook(u.config).skin, 10, 7, 0.9, 0.2 * u.config.scale, true, { bounce: true, spin: 12, grav: 26 }); }
        corpses.push({ e, t: 0, dir: Math.random() < 0.5 ? 1 : -1, back: headshot || Math.random() < 0.35 });
        if (award && !u.noLoot) dropLoot(u, e.position);
        if (u.config.ai === 'shocker' && (!NET.inGame || NET.host)) shockerDied(e, u);       // 5.0: frees its linked zombies and dies in an EMP burst
        if (u.config.id === 'splitter' && (!NET.inGame || NET.host)) {   // 3.8: bursts into Mites
            spawnParticles(c, 0xc084fc, 14, 8, 0.7, 0.25, false, { grav: 14 });
            for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.random(); const m = spawnEnemy(enemyTypes.mite, e.position.x + Math.cos(a) * 1.4, e.position.z + Math.sin(a) * 1.4, e.position.y + 0.6, waveSpeed(playerStats.level), waveReward(playerStats.level)); m.userData.noLoot = true; m.userData.dropping = false; }
        }
    }
    updateHUD();
    if (!NET.inGame || NET.host) checkWaveStatus();
}
function awardKill(u, c, headshot, src) {
    {
        combo++; comboTimer = 3.5;
        const mult = 1 + Math.min(combo - 1, 10) * 0.1;
        const reward = Math.round(u.reward * mult * DIFF().cash * (run.mode === 'rush' || run.mode === 'bossrush' ? 1.5 : 1) * (twist && twist.cash || 1));
        playerStats.money += reward;
        spawnDamageNumber(c.clone().setY(c.y + 0.8), `+$${reward}`, 'cash');
        runStats.kills++;
        runStats.weaponKills[src] = (runStats.weaponKills[src] || 0) + 1;
        streak++;
        if (streak >= STREAK_FOR_STRIKE) { streak = 0; if (strikeCharges < 2) { strikeCharges++; toast('AIRSTRIKE READY - press G', '#fca5a5', 2); sfx('strike'); } }
        if (headshot) runStats.headshots++;
        if (u.config.boss) { runStats.bosses++; bossDefeated(u.config); }
        gainXP(u.config.boss ? 200 : 10 + (headshot ? 5 : 0) + (u.config.hp >= 2 ? 10 : 0));
        sfx(headshot ? 'headkill' : 'kill');
        if (myClass() === 'assault' && abilityCd > 0) abilityCd = Math.max(0, abilityCd - 1);   // 4.0 ASSAULT passive
        chKill(u.config, headshot, src);                                                         // 4.0 challenges
    }
}
// Enemies topple over, then burst into blocks
function updateCorpses(dt) {
    for (let i = corpses.length - 1; i >= 0; i--) {
        const c = corpses[i]; c.t += dt;
        const k = Math.min(1, c.t / 0.42), u = c.e.userData;
        // a shot to the head throws the body backwards, otherwise it crumples and topples forwards; the limbs flop out
        const fall = c.back ? 1.35 : -1.45;
        c.e.rotation.x = fall * k * k;
        c.e.rotation.z = 0.25 * c.dir * k;
        if (u.armL) {
            u.armL.rotation.z = -1.1 * k; u.armR.rotation.z = 1.1 * k; u.armL.rotation.x = c.back ? -0.6 * k : -1.4 * (1 - k);
            u.armR.rotation.x = c.back ? -0.4 * k : -1.2 * (1 - k); u.legL.rotation.x = 0.7 * k; u.legR.rotation.x = -0.5 * k; u.head.rotation.x = (c.back ? -0.7 : 0.6) * k;
        }
        if (c.t > 0.5) { scene.remove(c.e); spawnDebris(c.e); disposeEnemy(c.e); corpses.splice(i, 1); }
    }
}
const _dbP = new V3();
function spawnDebris(e) {
    const u = e.userData; const s = u.config.scale;
    const n = Math.min(14, Math.round(8 * s) + 4);
    const fx = isUnlocked('killfx', settings.killfx) ? settings.killfx : 'blocks';
    const at = new V3(e.position.x, e.position.y + 0.4, e.position.z);
    if (fx !== 'blocks') {
        const cols = { confetti: [0xf472b6, 0x60a5fa, 0xfacc15, 0x4ade80, 0xc084fc], fire: [0xff6a1f, 0xffb020, 0xffe07a], ice: [0xa5f3fc, 0x67e8f9, 0xe0f2fe], void: [0x7c3aed, 0x1e1b4b, 0xc084fc], gold: [0xfbbf24, 0xfde68a, 0xd97706], stardust: [0xffffff, 0xc7d2fe, 0xfde68a, 0xa78bfa] }[fx];
        const glow = fx === 'fire' || fx === 'void' || fx === 'gold' || fx === 'stardust';
        cols.forEach(c => spawnParticles(at, c, Math.ceil(n * 1.2 / cols.length), fx === 'fire' ? 6 : 9, fx === 'fire' ? 0.9 : 1.3, (fx === 'confetti' ? 0.2 : 0.32) * s, !glow, fx === 'fire' ? { grav: -4, jitter: s, jitterY: u.totalHeight * 0.6 } : { bounce: true, spin: 14, grav: fx === 'confetti' ? 9 : 26, jitter: s, jitterY: u.totalHeight * 0.4, up: 1.4, drag: fx === 'confetti' ? 1.5 : 0 }));
        return;
    }
    _dbP.set(e.position.x, e.position.y + 0.2, e.position.z); spawnSmoke(_dbP, 2, 0.9 * s, 0.5, 0.8, 1.4 * s, 0.8, 0.4);       // dust poof
    spawnParticles(new V3(e.position.x, e.position.y + 0.3, e.position.z), zLook(u.config).skin, n, 9, 1.3, 0.42 * s, true, { bounce: true, spin: 12, grav: 28, jitter: s, jitterY: u.totalHeight * 0.4, up: 1.3 });
    spawnParticles(new V3(e.position.x, e.position.y + 0.5, e.position.z), u.config.color, Math.ceil(n / 2), 7, 1.1, 0.35 * s, true, { bounce: true, spin: 10, grav: 28, jitter: s, jitterY: u.totalHeight * 0.3 });
}


function checkWaveStatus() {
    if (enemies.length === 0 && waveActive) {
        waveActive = false;
        const bonus = Math.round((40 + playerStats.level * 15) * DIFF().cash * (run.mode === 'rush' || run.mode === 'bossrush' ? 1.5 : 1) * (twist && twist.cash || 1)); twist = null;
        playerStats.money += bonus;
        gainXP(40 + 10 * playerStats.level);
        chWave(playerStats.level);                  // 4.0 challenges
        playerStats.level++;
        saveJSON('blocky21_life', life);
        intermission = run.mode === 'rush' ? 4 : (NET.inGame ? 15 : 2.4);
        if (NET.inGame) netWaveCleared(playerStats.level);
        // clean up stray enemy shots so you can't die during the break
        projectiles.filter(p => p.kind === 'spit').forEach(removeProjectile);
        toast(`WAVE CLEARED!  +$${bonus}`, '#4ade80', 2.2);
        if (!NET.on) autoSaveRun(true);         // single player: checkpoint at the start of the next wave
        sfx('wave');
        updateHUD();
        if (CAMP.on) campWaveCleared();
    }
}


const _hurtDir = new V3(), _camDir = new V3();
let lastHurtBy = '';
function takeDamage(amount, fromPos, by) {
    if (currentHp <= 0 || currentGameState !== 'playing' || debugGod || run.mode === 'sandbox' || NET.spec || NET.lockT > 0) return;
    if (CAMP.on && CAMP.inv > 0) return;       // 5.0 campaign: a moment of grace after you go down
    lastHurtT = gameTime;
    if (by) lastHurtBy = by;
    // no one-shots: a single hit from an enemy can never take more than 45% of your max health (PvP excluded)
    if (!NET.pvp) amount = Math.min(amount, maxHp * 0.45);
    if (adrenOn() && clsUp('assault', 3)) amount *= 0.6;     // 4.0 ASSAULT: UNSTOPPABLE
    if (lungeT > 0) amount *= 0.5;                             // 4.0 KATANA: half damage while lunging
    streak = 0;
    const tier = playerStats.armorTier ? armorDb[playerStats.armorTier] : null;
    if (tier && currentArmor > 0) {
        const absorbed = Math.min(currentArmor, amount * tier.absorb);
        currentArmor -= absorbed; amount -= absorbed;
    }
    if (CAMP.on) CAMP.dmg += amount;
    if (amount > 0.01) waveHurt = true;          // 4.0: "clear a wave without losing health" challenge
    currentHp -= amount;
    screenFlash('rgba(220,38,38,0.45)', true);
    shake = Math.max(shake, 0.2);
    sfx('hurt');
    if (fromPos) showHurtDir(fromPos);
    updateHUD();
    if (currentHp <= 0) die();
}
function showHurtDir(fromPos) {
    camera.getWorldDirection(_camDir); _camDir.y = 0; _camDir.normalize();
    _hurtDir.set(fromPos.x - camera.position.x, 0, fromPos.z - camera.position.z);
    if (_hurtDir.lengthSq() < 0.01) return;
    _hurtDir.normalize();
    const ang = Math.atan2(_camDir.x * _hurtDir.z - _camDir.z * _hurtDir.x, _camDir.x * _hurtDir.x + _camDir.z * _hurtDir.z);
    if (ui.dmgDir.childElementCount > 6) ui.dmgDir.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'dd'; el.style.transform = `rotate(${ang}rad)`;
    ui.dmgDir.appendChild(el);
    setTimeout(() => el.remove(), 1150);
}


// 5.2: screen flashes never stack, loop or strobe. One at a time, at least 0.3s apart (0.45s for the red hit flash), capped in strength,
// softer when "Reduce flashes" is on, and never when nobody is looking at the game (menus, hidden tab). The flash always clears itself on a timer.
let _flashAt = -9, _flashClr = 0;
function screenFlash(color, hit) {
    if (currentGameState !== 'playing' && currentGameState !== 'dead' && currentGameState !== 'gameover') return;
    const now = performance.now();
    if (now - _flashAt < (hit ? 450 : 300)) return;
    _flashAt = now;
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(color);
    if (m) {
        let r = +m[1], g = +m[2], b = +m[3], a = m[4] === undefined ? 1 : +m[4];
        const lum = (r + g + b) / 765;
        a = Math.min(a, lum > 0.8 ? 0.18 : 0.4);                // near-white is capped hard: no flashbang look
        if (settings.reduceFlash !== false) a *= 0.55;
        color = `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;
    }
    const el = ui.flash;
    clearTimeout(_flashClr);
    el.style.transition = 'none'; el.style.background = color; el.style.opacity = '1';
    requestAnimationFrame(() => { el.style.transition = 'opacity 0.35s'; el.style.opacity = '0'; });
    _flashClr = setTimeout(() => { el.style.transition = 'none'; el.style.opacity = '0'; }, 500);
}
// 5.2: can the player actually see this spot? (in front of the camera or very close, and no wall in between)
const _fxv = new V3();
function fxVisible(pos, maxDist = 90) {
    const d = camera.position.distanceTo(pos);
    if (d > maxDist) return false;
    if (d < 2.5) return true;
    camera.getWorldDirection(_fxv);
    if (_fxv.dot(new V3().subVectors(pos, camera.position).multiplyScalar(1 / d)) < -0.15) return false;
    return losClear(camera.position.x, camera.position.y, camera.position.z, pos.x, pos.y + 0.3, pos.z);
}


// Fold a finished run into the lifetime stats (sandbox runs don't count)
function commitLife() {
    const s = runStats;
    if (run.mode === 'sandbox' || s.time < 2) return false;
    life.runs++; life.kills += s.kills; life.headshots += s.headshots; life.bosses += s.bosses;
    life.shots += s.shots; life.hits += s.hits; life.damage += Math.round(s.damage); life.time += s.time;
    life.waves += Math.max(0, playerStats.level - 1 - (s.waveBase || 0));   // waveBase: waves already counted by a death before a continue
    for (const k in s.weaponKills) life.weaponKills[k] = (life.weaponKills[k] || 0) + s.weaponKills[k];
    const ck = myClass();
    if (ck) { const c = life.cls[ck] || (life.cls[ck] = { runs: 0, kills: 0, best: 0 }); c.runs++; c.kills += s.kills; c.best = Math.max(c.best || 0, playerStats.level); }
    if (MAPS[run.map]) { const m = life.maps[run.map] || (life.maps[run.map] = { runs: 0, waves: 0, best: 0 }); m.runs++; m.waves += Math.max(0, playerStats.level - 1 - (s.waveBase || 0)); m.best = Math.max(m.best || 0, playerStats.level); }   // 4.0
    chSave();
    const key = bestKey(run.diff, run.mode);
    const prev = life.best[key] || 0, newBest = playerStats.level > prev;
    if (newBest) life.best[key] = playerStats.level;
    saveJSON('blocky21_life', life);
    runStats.time = 0;
    return newBest;
}
// Sky Islands: you fell off. Sandbox / god mode just puts you back on the middle island.
function fellOff() {
    velocity.set(0, 0, 0); push.set(0, 0, 0);
    if (run.mode === 'sandbox' || debugGod || currentHp <= 0 || currentGameState !== 'playing') { camera.position.set(spawnPt[0], EYE_STAND, spawnPt[1]); feetY = 0; return; }
    // co-op: a fall costs a third of your health and puts you back on the nearest cloud, instead of knocking you out for the wave
    if (NET.inGame && !NET.pvp && !NET.dead && currentHp > maxHp * 0.34) {
        const s = nearestSafe(camera.position.x, camera.position.z) || [spawnPt[0], 0, spawnPt[1]];
        currentHp -= Math.round(maxHp * 0.33); camera.position.set(s[0], s[1] + EYE_STAND, s[2]); feetY = s[1];
        toast('YOU FELL! -' + Math.round(maxHp * 0.33) + ' HP', '#fca5a5', 1.4); sfx('hurt'); updateHUD(); return;
    }
    if (NET.inGame && NET.dead) { const s = nearestSafe(spawnPt[0], spawnPt[1]); camera.position.set(s ? s[0] : spawnPt[0], (s ? s[1] : 0) + EYE_STAND, s ? s[2] : spawnPt[1]); feetY = s ? s[1] : 0; return; }
    lastHurtBy = 'falling off the clouds'; currentHp = 0; updateHUD(); sfx('hurt');
    die();
    if (NET.inGame) { const s = nearestSafe(spawnPt[0], spawnPt[1]); camera.position.set(s ? s[0] : spawnPt[0], (s ? s[1] : 0) + EYE_STAND, s ? s[2] : spawnPt[1]); feetY = s ? s[1] : 0; }
}
function die() {
    if (CAMP.on && !NET.inGame) { campDeath(); return; }
    if (NET.inGame) { netLocalDeath(); return; }
    // 3.8: permadeath - dying ends the run for good and deletes its save (the auto-save is only for quitting and coming back)
    const sv = runSaveOK() ? loadRunSave() : null;
    const kept = false;
    const s = runStats, wave = playerStats.level;
    const acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
    const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60);
    const favorite = Object.entries(s.weaponKills).sort((a, b) => b[1] - a[1])[0];
    const newBest = commitLife();
    if (sv) clearRunSave();
    document.querySelector('#gameover-overlay p').textContent = sv ? 'RUN OVER - YOUR SAVE WAS DELETED' : 'ALL PROGRESS LOST';
    $('btn-go-continue').classList.toggle('hidden', !kept);
    if (kept) $('btn-go-continue').textContent = `CONTINUE FROM WAVE ${sv.stats.level}`;
    ui.btnRespawn.textContent = kept ? 'NEW RUN' : 'START OVER';
    const best = life.best[bestKey(run.diff, run.mode)] || wave;
    $('gameover-stats').innerHTML = (lastHurtBy ? `<span class="text-red-300 font-bold">Killed by ${lastHurtBy}.</span> ` : '') + `You reached <b class="text-white">Wave ${wave}</b> on <b style="color:${DIFF().color}">${DIFF().name}</b> (${MODES[run.mode].name}, ${MAPS[run.map].name}${myClass() ? ', as ' + CLASSES[myClass()].name : ''}).` + (newBest ? ' <b class="text-amber-300">NEW PERSONAL BEST!</b>' : ` Best: Wave ${best}.`);
    $('gameover-grid').innerHTML = [['KILLS', s.kills], ['HEADSHOTS', s.headshots], ['ACCURACY', acc + '%'], ['DAMAGE', Math.round(s.damage)], ['TIME', `${mm}:${String(ss).padStart(2, '0')}`], ['TOP KILLER', favorite ? killerName(favorite[0]) : '-']]
        .map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
    const ri = rankInfo();
    $('gameover-xp').innerHTML = run.mode === 'sandbox' ? '<div class="text-gray-400 font-bold">Sandbox runs don\'t earn XP.</div>' :
        `<div class="flex items-center gap-3 font-black"><span class="text-amber-300 text-2xl">RANK ${ri.rank}</span><div class="w-72 h-3 bg-black/50 rounded overflow-hidden"><div class="h-full bg-amber-400" style="width:${ri.into / ri.need * 100}%"></div></div><span class="text-green-300">+${runXP} XP</span></div>` +
        (runUnlocks.length ? `<div class="mt-2 text-sm font-bold text-green-300">UNLOCKED: ${runUnlocks.join(' \u00b7 ')}</div>` : '');
    resetRun();
    changeGameState('gameover');
}


// ---------- XP ----------
let runXP = 0, runUnlocks = [];
// raw (4.0): a flat amount (challenge rewards) - no difficulty / mode / prestige multiplier
function gainXP(n, raw = false) {
    if (run.mode === 'sandbox') return;
    const before = rankInfo().rank;
    const amt = raw ? Math.round(n) : Math.round(n * (XP_MULT[run.diff] || 1) * (run.mode === 'rush' ? 1.2 : run.mode === 'bossrush' ? 1.3 : 1) * (1 + 0.05 * prestigeLvl()));
    life.xp += amt; runXP += amt;
    const after = rankInfo().rank;
    if (after >= MAX_RANK && before < MAX_RANK && prestigeLvl() < MAX_PRESTIGE) {      // 4.0
        setTimeout(() => showIntel(`<div class="text-sm font-black text-amber-300 hud-text">MAX RANK REACHED!</div><div class="text-xs text-gray-100">You can PRESTIGE from the main menu (RANKS tab): back to rank 1 with a new badge, +5% XP and +$100 starting cash per prestige - and you keep everything you've unlocked.</div>`, 9), 2500);
    }
    if (after > before) {
        updateRankHUD();
        const got = [];
        for (let r = before + 1; r <= after; r++) unlocksAtRank(r).forEach(u => got.push(unlockLabel(u.kind, u.id)));
        runUnlocks.push(...got);
        toast(`RANK UP! RANK ${after}` + (got.length ? `  \u00b7  ${got.length} UNLOCK${got.length > 1 ? 'S' : ''}` : ''), '#fcd34d', 2.6);
        if (got.length) showIntel(`<div class="text-sm font-black text-amber-300 hud-text">RANK ${after} UNLOCKED</div>` + got.map(g => `<div class="text-xs text-gray-100">${g}</div>`).join(''), 6);
        sfx('upgrade');
        saveJSON('blocky21_life', life);
    }
}
const rankOK = (kind, id) => isUnlocked(kind, id);
function killerName(k) { return weaponsDb[k] ? weaponsDb[k].name : ({ explosive: 'Explosives', molotov: 'Molotov', turret: 'Turret', melee: 'Melee', airstrike: 'Airstrike', landmine: 'Landmine', nuke: 'Nuke', boom: 'Explosive Rounds' }[k] || k); }
