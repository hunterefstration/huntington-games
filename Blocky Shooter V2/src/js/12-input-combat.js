// ==========================================
// 4. INPUT & COMBAT
// ==========================================


function onKeyDown(event) {
    if (currentGameState !== 'playing') return;
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break;
        case 'ShiftLeft': case 'ShiftRight': sprintHeld = true; break;
        case 'Space': jumpHeld = true; event.preventDefault(); break;
        case 'KeyR': triggerReload(); break;
        case 'KeyQ': if (!event.repeat) useSecondary(); break;
        case 'KeyC': if (!event.repeat) startSlide(); break;
        case 'KeyV': if (!event.repeat) melee(); break;
        case 'KeyE': aimHeld = true; break;
        case 'KeyG': if (!event.repeat) callAirstrike(); break;
        case 'KeyX': if (!event.repeat) useAbility(); break;
        case 'KeyF': if (!event.repeat && !isReloading && vm.adsT < 0.2 && vm.inspect <= 0) vm.inspect = 2.4; break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
        case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9': case 'Digit0': {
            const n = parseInt(event.code.slice(5));
            const id = ownedWeapons()[n === 0 ? 9 : n - 1];
            if (id) switchWeapon(id);
            break;
        }
        case 'Minus': case 'NumpadSubtract': { const id = ownedWeapons()[10]; if (id) switchWeapon(id); break; }
    }
}


function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
        case 'ShiftLeft': case 'ShiftRight': sprintHeld = false; break;
        case 'Space': jumpHeld = false; break;
        case 'KeyE': aimHeld = false; break;
    }
}


function onMouseDown(event) {
    if (currentGameState !== 'playing') return;
    if (event.button === 0) { isMouseDown = true; triggerFresh = true; }
    if (event.button === 2) aimHeld = true;
}
function onMouseUp(event) {
    if (event.button === 0) isMouseDown = false;
    if (event.button === 2) aimHeld = false;
}
function onMouseMove(event) {
    if (currentGameState !== 'playing' || !controls.isLocked) return;
    vm.swayX = clamp(vm.swayX - (event.movementX || 0) * 0.00022, -0.05, 0.05);
    vm.swayY = clamp(vm.swayY + (event.movementY || 0) * 0.00022, -0.04, 0.04);
}
function onWheel(event) {
    if (currentGameState !== 'playing') return;
    const order = WEAPON_ORDER.filter(id => playerStats.weapons.includes(id));
    if (order.length < 2) return;
    let i = order.indexOf(playerStats.currentWeapon);
    i = (i + (event.deltaY > 0 ? 1 : -1) + order.length) % order.length;
    switchWeapon(order[i]);
}


function switchWeapon(id) {
    if (!playerStats.weapons.includes(id) || id === playerStats.currentWeapon) return;
    playerStats.currentWeapon = id;
    updateGunModel();
    updateHUD();
    sfx('swap');
}
function updateGunModel() {
    cancelReload();
    showWeaponModel(playerStats.currentWeapon);
}
// 5.0 Shocker: its zap (or its EMP death burst) JAMS your gun: no firing, a reload in progress is cancelled, the HUD says JAMMED
let jamT = 0;
function jamGun(t) {
    if (currentHp <= 0) return;
    const was = jamT > 0;
    jamT = Math.max(jamT, t);
    cancelReload(); burstLeft = 0;
    ui.txtReloading.textContent = 'JAMMED!'; ui.txtReloading.style.color = '#7dd3fc'; ui.txtReloading.classList.remove('hidden');
    if (!was) { sfx('dry'); shake = Math.max(shake, 0.25); }
}
function tickJam(dt) {
    if (jamT <= 0) return;
    jamT -= dt;
    if (jamT <= 0 || currentHp <= 0) { jamT = 0; ui.txtReloading.textContent = 'RELOADING...'; ui.txtReloading.style.color = ''; ui.txtReloading.classList.add('hidden'); }
}
function cancelReload() { isReloading = false; reloadTimer = 0; reloadEnding = 0; ui.txtReloading.classList.add('hidden'); }


function startSlide() {
    const spd = Math.hypot(velocity.x, velocity.z);
    if (!onGround || slideT > 0 || slideCd > 0 || spd < 3.5) return;
    slideT = 0.75; slideCd = 1.1;
    const k = Math.max(spd * 1.6, 12.5) / spd;
    velocity.x *= k; velocity.z *= k;
    sfx('slide');
    spawnParticles(new V3(camera.position.x, feetY + 0.1, camera.position.z), 0x9ca3af, 6, 3, 0.5, 0.18, true, { grav: 4, drag: 3 });
}


function triggerReload() {
    if (isReloading || currentHp <= 0 || jamT > 0) return;
    const id = playerStats.currentWeapon, w = W(id);
    if (w.melee || ammoState[id] >= w.magSize) return;
    if (railC > 0) railCancel();
    burstLeft = 0; vm.inspect = 0;
    isReloading = true; reloadEnding = 0;
    reloadStyle = w.reloadStyle; reloadElapsed = 0;
    if (reloadStyle === 'shell') {
        reloadTotal = 99; reloadTimer = 99;
        shellTimer = w.shellTime / 1000;
    } else {
        reloadTotal = w.reloadTime / 1000;
        reloadTimer = reloadTotal;
    }
    vm.reloadMarks = {};
    ui.txtReloading.classList.remove('hidden');
    sfx('reload');
}
function finishReload() {
    const id = playerStats.currentWeapon;
    ammoState[id] = W(id).magSize;
    isReloading = false;
    ui.txtReloading.classList.add('hidden');
    updateHUD();
}
function tickReload(dt) {
    const id = playerStats.currentWeapon, w = W(id);
    reloadElapsed += dt;
    if (reloadStyle === 'shell') {
        if (reloadElapsed < 0.25) return;
        shellTimer -= dt;
        if (shellTimer <= 0) {
            ammoState[id] = Math.min(w.magSize, ammoState[id] + 1);
            sfx('shell'); updateHUD();
            shellTimer += w.shellTime / 1000;
            if (ammoState[id] >= w.magSize) endShellReload();
        }
        return;
    }
    reloadTimer -= dt;
    const t = 1 - reloadTimer / reloadTotal, mk = vm.reloadMarks || (vm.reloadMarks = {});
    // sound + shells synced to the animation
    if (reloadStyle === 'revolver') {
        if (t > 0.22 && !mk.a) { mk.a = 1; ejectCasing(vmModel, 'dump', 6); sfx('magout'); }
        if (t > 0.6 && !mk.b) { mk.b = 1; sfx('magin'); }
        if (t > 0.76 && !mk.c) { mk.c = 1; sfx('rack'); }
    } else {
        if (t > 0.18 && !mk.a) { mk.a = 1; sfx('magout'); }
        if (t > 0.62 && !mk.b) { mk.b = 1; sfx('magin'); }
        if (t > 0.74 && !mk.c) { mk.c = 1; sfx(reloadStyle === 'bolt' ? 'bolt' : 'rack'); }
    }
    if (reloadTimer <= 0) finishReload();
}
function endShellReload() {
    isReloading = false; reloadEnding = 0.3;
    ui.txtReloading.classList.add('hidden');
    vm.pump = 0.5; sfx('pump');
    setTimeout(() => { if (vmModel && (vmModel.id === 'shotgun' || vmModel.id === 'lever')) ejectCasing(vmModel, 'shell'); }, 150);
}


const _fwd = new V3(), _right = new V3(), _up = new V3(), _dir = new V3(), _muzzleW = new V3(), _v2 = new THREE.Vector2();
function currentSpread(w) {
    let s = w.spread;
    const moving = Math.hypot(velocity.x, velocity.z) > 2;
    if (w.scoped) s = vm.adsT > 0.85 ? 0.0003 : s * 1.5;
    else if (!w.noAds) s *= (1 - (w.id === 'shotgun' ? 0.35 : 0.65) * vm.adsT) * lerp(w.hipMul, w.adsMul, vm.adsT);   // 4.0 attachments: GRIP (hip) / SCOPE (aiming)
    if (moving) s *= w.scoped ? 2 : (w.hipMul < 1 ? 1.25 : 1.4);
    if (!onGround) s *= 2;
    if (slideT > 0) s *= 1.3;
    if (w.bloom) s *= 1 + Math.min(heat, 20) * w.bloom;
    return s;
}


function canShoot() {
    return currentGameState === 'playing' && currentHp > 0 && jamT <= 0 && vm.raise > 0.75 && vm.sprint < 0.5 && !(vm.melee > 0);
}
function weaponTick(dt) {
    const id = playerStats.currentWeapon, w = W(id);
    if (w.spinUp) {
        const want = (isMouseDown || aimHeld) && !isReloading && currentHp > 0;
        const was = spinT;
        spinT = clamp(spinT + (want ? dt / w.spinUp : -dt / (w.spinUp * 1.6)), 0, 1);
        if (was === 0 && spinT > 0) sfx('spin');
    } else spinT = 0;
    heat = Math.max(0, heat - dt * (isMouseDown ? 2 : 7));
    if (meleeCd > 0) meleeCd -= dt;
    if (jamT > 0) tickJam(dt);
    if (isReloading) tickReload(dt);
    if (reloadEnding > 0) reloadEnding = Math.max(0, reloadEnding - dt);
    if (burstLeft > 0 && gameTime >= nextBurstAt) {
        if (canShoot() && !isReloading && ammoState[id] > 0) { fireOnce(w); burstLeft--; nextBurstAt = gameTime + w.burstGap / 1000; }
        else burstLeft = 0;
    }
    // 4.0 weapons
    if (lungeCd > 0) lungeCd = Math.max(0, lungeCd - dt);
    if (slashAt >= 0 && gameTime >= slashAt) { slashAt = -1; if (w.melee && currentHp > 0) katanaHits(w); }
    if (w.melee) { if (aimHeld && !aimWas) lunge(w); updateAmmoHUD(); }
    aimWas = aimHeld;
    if (w.charge) {
        railTick(w); triggerFresh = false;
        if (railC > 0) { const pc = Math.round(railC * 50) * 2; if (ui.railRing._pc !== pc) { ui.railRing._pc = pc; setStyle(ui.railRing, '--p', String(pc)); } setStyle(ui.railRing, 'opacity', '1'); }
        return;
    }
    // (triggerFresh also counts a click that was pressed and released between two frames - slow Chromebooks)
    if ((isMouseDown || triggerFresh) && (w.auto || triggerFresh)) tryFire(w, triggerFresh);
    triggerFresh = false;
}
function tryFire(w, fresh) {
    if (!canShoot() || burstLeft > 0) return;
    const id = w.id;
    if (w.melee) {       // 4.0 KATANA: no ammo, just swing
        if (lungeT <= 0 && (gameTime - lastShootTime) * 1000 >= w.fireRate * (adrenOn() && clsUp('assault', 2) ? 0.8 : 1)) { lastShootTime = gameTime; katanaSlash(w); }
        return;
    }
    if (isReloading) {
        if (reloadStyle === 'shell' && ammoState[id] > 0) { isReloading = false; reloadEnding = 0.2; ui.txtReloading.classList.add('hidden'); }
        else return;
    }
    const rate = w.fireRate * (adrenOn() && clsUp('assault', 2) ? 0.8 : 1);
    if ((gameTime - lastShootTime) * 1000 < rate) return;
    if (vm.bolt >= 0) return;
    if (w.spinUp && spinT < 1) return;
    if (ammoState[id] <= 0) { if (fresh) sfx('dry'); triggerReload(); return; }
    lastShootTime = gameTime;
    if (w.burst) { burstLeft = w.burst - 1; nextBurstAt = gameTime + w.burstGap / 1000; }
    fireOnce(w);
}


function tracerColor(def) {
    const t = TRACERS[settings.tracer];
    if (!t || !isUnlocked('tracer', settings.tracer) || (t.c === undefined && !t.rainbow)) return def;
    return t.rainbow ? _col.setHSL((gameTime * 0.6) % 1, 1, 0.6).getHex() : t.c;
}
function getMuzzleWorld(out) {
    // project the gun's muzzle (drawn with its own camera) onto the main view so tracers start where you see the barrel
    if (vmModel && vmModel.root.visible) {
        vmModel.root.updateMatrixWorld(true);
        vmModel.muzzle.getWorldPosition(out);
        out.project(weaponCam);
        _v2.set(clamp(out.x, -1, 1), clamp(out.y, -1, 1));
    } else _v2.set(0.02, -0.08);
    raycaster.setFromCamera(_v2, camera);
    return out.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 1.1);
}


function fireOnce(w) {
    const id = w.id;
    if (ammoState[id] <= 0) { burstLeft = 0; triggerReload(); return; }
    ammoState[id]--;
    runStats.shots++;
    vm.inspect = 0;


    const adsK = 1 - 0.5 * vm.adsT;
    vm.kick += w.recoil * (0.7 + 0.3 * (1 - vm.adsT));
    vm.kickRot += w.recoil * 1.5 * adsK;
    vm.kickRoll += (Math.random() - 0.5) * w.recoil * 0.8 * adsK;
    aimPunch += w.punch * (0.75 + 0.25 * (1 - vm.adsT));
    yawPunch += (Math.random() - 0.5) * w.punch * 0.35;
    VM.flash.opacity = 1;
    if (vmModel) { vmModel.flash.rotation.z = Math.random() * Math.PI; vmModel.flash.scale.setScalar(0.8 + Math.random() * 0.45); }
    vmLight.intensity = 2.2;
    if (muzzleLight) muzzleLight.intensity = 22;
    fakeMuzzle();
    switch (id) {
        case 'pistol': vm.slideKick = 1; ejectCasing(vmModel); break;
        case 'revolver': vm.cylTarget += Math.PI / 3; vm.hammer = 1; break;
        case 'shotgun': vm.pump = 0.5; setTimeout(() => { if (vmModel && vmModel.id === 'shotgun') { ejectCasing(vmModel, 'shell'); sfx('pump'); } }, 170); break;
        case 'lever': setTimeout(() => { if (vmModel && vmModel.id === 'lever') { vm.pump = 0.5; ejectCasing(vmModel, 'shell'); sfx('rack'); } }, 120); break;
        case 'sniper': vm.bolt = 0; vm.boltEjected = false; break;
        case 'rpg': case 'crossbow': case 'flamer': case 'tesla': case 'railgun': break;
        case 'glauncher': vm.cylTarget += Math.PI / 3; vm.hammer = 1; break;
        case 'dual': {     // 4.0: the guns take turns - move the flash / muzzle / ejection port to the one firing
            const s = vm.akSide = vm.akSide ? 0 : 1, m = vmModel;     // 1 = the left gun
            if (m && m.fx.ox) { const k = -2 * m.g.position.x / m.g.scale.y; m.muzzle.position.x = m.flash.position.x = s ? k - m.def.muzzle[0] : m.def.muzzle[0]; m.eject.position.x = s ? k - m.def.eject[0] : m.def.eject[0]; }
            if (s) vm.slideKickL = 1; else vm.slideKick = 1;
            ejectCasing(vmModel, 'brass', 1, s);
            vm.kickRoll += s ? 0.02 : -0.02;
            break;
        }
        default: vm.slideKick = 1; ejectCasing(vmModel);
    }
    VM.flash.color.setHex(id === 'railgun' ? 0x8ff8ff : id === 'tesla' ? 0xb4c0ff : 0xffffff);
    shake = Math.max(shake, w.recoil * 0.3);
    sfx(id);
    heat += 1;


    getMuzzleWorld(_muzzleW);
    camera.getWorldDirection(_fwd);
    if (!w.flame && !w.tesla) muzzleBurst(_muzzleW, _fwd, w.pellets > 1 ? 0.8 : 1);
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const spread = currentSpread(w);
    const dmgMul = clsDmg() * (w.charge ? 0.25 + 0.75 * railC : 1);      // 4.0 railgun: damage follows the charge
    if (w.rocket) { fireRocket(w, dmgMul, spread); updateAmmoHUD(); return; }
    if (w.grenade) { fireGrenade(w, dmgMul, spread); updateAmmoHUD(); autoReloadSoon(id, 300); return; }
    if (w.tesla) { fireTesla(w, dmgMul); updateAmmoHUD(); autoReloadSoon(id, 200); return; }
    if (w.flame) { fireFlame(w, dmgMul); updateAmmoHUD(); if (ammoState[id] <= 0) setTimeout(() => { if (currentGameState === 'playing' && playerStats.currentWeapon === id && ammoState[id] <= 0) triggerReload(); }, 200); return; }
    const perEnemy = new Map();
    for (let p = 0; p < w.pellets; p++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
        _dir.copy(_fwd).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize();
        const end = traceShot(camera.position, _dir, w, perEnemy, dmgMul);
        if (w.rail) railBeamFx(_muzzleW, end, railC);
        else if (p < 6) spawnTracer(_muzzleW, end, tracerColor(id === 'sniper' ? 0xc4b5fd : (id === 'dmr' ? 0xfde68a : id === 'crossbow' ? 0xb45309 : 0xffe9a8)), id === 'sniper' ? 0.07 : id === 'crossbow' ? 0.035 : 0.022, id === 'sniper' ? 0.2 : id === 'crossbow' ? 0.18 : 0.09);
        if (NET.inGame && p < 3) netRecordShot(_muzzleW, end);
    }
    perEnemy.forEach((rec, enemy) => damageEnemy(enemy, rec.dmg, rec.head, rec.point, false, w.knock ? rec.dir : null, rec.hits));
    if (perEnemy.size) runStats.hits++;
    updateAmmoHUD();
    if (ammoState[id] <= 0) { burstLeft = 0; setTimeout(() => { if (currentGameState === 'playing' && playerStats.currentWeapon === id && ammoState[id] <= 0) triggerReload(); }, id === 'sniper' ? 850 : 250); }
}


// 3.8 Flamethrower: everything in a short cone in front of you (walls stop it, riot shields do not) takes damage and catches fire
const _fl = new V3();
function fireFlame(w, dmgMul) {
    const o = camera.position, wall = raySolids(o, _fwd, w.range), reach = wall ? wall.t : w.range, cosA = Math.cos(w.cone);
    for (let k = 1; k <= 4; k++) { const d = reach * k / 4.5; _fl.copy(_muzzleW).addScaledVector(_fwd, d).add(new V3((Math.random() - 0.5) * d * 0.25, (Math.random() - 0.5) * d * 0.2, (Math.random() - 0.5) * d * 0.25)); spawnParticles(_fl, k % 2 ? 0xff6a1f : 0xffb020, 2, 1.5 + k, 0.32, 0.22 + k * 0.1, false, { grav: -3 }); }
    let hit = false;
    for (const e of enemies.slice()) {
        const u = e.userData; if (u.dead) continue;
        _fl.set(e.position.x - o.x, e.position.y + u.totalHeight * 0.5 - o.y, e.position.z - o.z);
        const d = _fl.length(); if (d > reach + u.radius) continue;
        _fl.multiplyScalar(1 / (d || 1)); if (_fl.dot(_fwd) < cosA && d > u.radius * 1.5) continue;
        damageEnemy(e, w.damage * dmgMul, false, null, true, null, 1, 'flamer');
        if (!u.dead && !u.config.fireImmune) { u.burnT = 3; u.burnDps = w.damage * 2.2 * dmgMul; }
        hit = true;
    }
    if (hit) runStats.hits++;
}
