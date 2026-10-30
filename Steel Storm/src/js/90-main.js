// ============================================================
// INPUT, CAMERA, THE MAIN LOOP, BOOT, and the debug hook window.__steelstorm
// ============================================================
const IN = { keys: {}, mb: [0, 0, 0], camYaw: 0, camPitch: .2, zoom: 1 };
const Cam = {
    aimD: 0, aim: { x: 0, y: 0, z: 0 }, deadYaw: 0,
    reset() { if (!ME) return; IN.camYaw = ME.yaw; IN.camPitch = ME.def.ln === 'a' ? 0.05 : 0.22; IN.zoom = 1; },
    lock() { try { const r = $('#gl').requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} },
    locked() { return document.pointerLockElement === $('#gl'); }
};
// where to aim to hit a moving target o with a shot of speed v fired from `from` (the shooter's own speed adds to bullets/rockets in the air)
function leadPoint(e, o, v, from) {
    const air = o.def.ln === 'a', cy = o.y + (air ? 0 : 1.5), sp = Math.max(60, v * (e.def.ln === 'a' ? 1 : .97) + (e.def.ln === 'a' ? e.speed * .9 : 0));
    let px = o.x, py = cy, pz = o.z;
    for (let i = 0; i < 3; i++) { const tt = Math.hypot(px - from.x, py - from.y, pz - from.z) / sp; px = o.x + o.vx * tt; py = cy + (air ? o.vy * tt : 0); pz = o.z + o.vz * tt; }
    return { x: px, y: py, z: pz };
}
function aimRay(e) {
    camera.getWorldDirection(V3); const dx = V3.x, dy = V3.y, dz = V3.z, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    let t = 1200, found = false;
    for (let s = 20; s < 1200; s += 6) { if (oy + dy * s < GHS(ox + dx * s, oz + dz * s)) { let lo = s - 6, hi = s; for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (oy + dy * m < GHS(ox + dx * m, oz + dz * m)) hi = m; else lo = m; } t = hi; found = true; break; } }
    let best = null, bt = t;
    for (const o of EN.values()) {
        if (!o.alive || o.team === e.team) continue;
        const cy = o.y + (o.def.ln === 'a' ? 0 : 1.5), vx = o.x - ox, vy = cy - oy, vz = o.z - oz, tt = vx * dx + vy * dy + vz * dz;
        if (tt < 8 || tt > bt) continue;
        const px = ox + dx * tt - o.x, py = oy + dy * tt - cy, pz = oz + dz * tt - o.z;
        if (Math.sqrt(px * px + py * py + pz * pz) < o.def.r * 1.8 + tt * .02) { best = o; bt = tt; }
    }
    Cam.lead = null;
    if (best) { const lp = leadPoint(e, best, e.def.w1.v, e.mdl ? muzzleWorld(e, 0) : e); Cam.lead = { x: lp.x, y: lp.y, z: lp.z, id: best.id, D: bt }; return lp; }
    return { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t };
}
function playerCtrl(e, dt) {
    const k = IN.keys, d = e.def, c = { thr: 0, steer: 0, aimYaw: e.tur, aimPitch: 0, f1: !!IN.mb[0], f2: !!(IN.mb[2] || k.Space), f3: !!(k.KeyB || k.ShiftLeft || k.ShiftRight) };
    const W = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), A = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    if (d.ln === 'a') {
        e.thr = clamp(e.thr + W * dt * .6, 0, 1); c.thr = e.thr;
        IN.camYaw += A * dt * 1.5; IN.camPitch = clamp(IN.camPitch + ((k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)) * dt * .9, -1.3, 1.3);
        c.aimYaw = IN.camYaw; c.aimPitch = IN.camPitch;
        // soft aim assist: an enemy near the reticle pulls the nose onto its lead point, so the guns (which converge there) can hit
        Cam.lead = null; camera.getWorldDirection(V3);
        const dx = V3.x, dy = V3.y, dz = V3.z, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z; let bestA = .07;
        for (const o of EN.values()) {
            if (!o.alive || o.team === e.team) continue;
            const vx = o.x - ox, vy = o.y - oy, vz = o.z - oz, L = Math.hypot(vx, vy, vz); if (L < 40 || L > 800) continue;
            const ang = Math.acos(clamp((vx * dx + vy * dy + vz * dz) / L, -1, 1));
            if (ang < bestA) { bestA = ang; const lp = leadPoint(e, o, d.w1.v, e); Cam.lead = { x: lp.x, y: lp.y, z: lp.z, id: o.id, D: Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) }; }
        }
        if (Cam.lead) { const lx = Cam.lead.x - e.x, ly = Cam.lead.y - e.y, lz = Cam.lead.z - e.z; c.aimYaw = Math.atan2(lx, lz); c.aimPitch = Math.atan2(ly, Math.hypot(lx, lz)); }
    } else {
        if (d.ln === 'n') { e.thr = clamp(e.thr + W * dt * .45, -.45, 1); c.thr = e.thr; c.steer = -A; } else { c.thr = W; c.steer = -A; }
        const p = aimRay(e), m = muzzleWorld(e, 0), b = ballistic(m.x, m.y, m.z, p.x, p.y, p.z, d.w1.v, d.w1.g);
        Cam.aimD = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z); c.aimYaw = b.yaw; c.aimPitch = b.pitch;
    }
    return c;
}
function updateCamera(dt) {
    if (!ME) return;
    const e = ME; let yaw = IN.camYaw, pit = IN.camPitch, target = e;
    const d = e.def;
    if (!e.alive) {
        Cam.deadYaw += dt * .35; yaw = Cam.deadYaw; pit = .45; const dist = 40, cx = e.x, cy = e.y + 4, cz = e.z;
        camera.position.set(cx - Math.sin(yaw) * Math.cos(pit) * dist, cy + Math.sin(pit) * dist, cz - Math.cos(yaw) * Math.cos(pit) * dist); camera.lookAt(cx, cy, cz);
    } else {
        Cam.deadYaw = yaw;
        const cp = Math.cos(pit), dist = d.cd * IN.zoom, lift = d.ln === 'a' ? 3 : d.ln === 'n' ? 6 : 3.2;
        const cx = e.x, cy = e.y + lift, cz = e.z;
        camera.position.set(cx - Math.sin(yaw) * cp * dist, cy - Math.sin(pit) * dist, cz - Math.cos(yaw) * cp * dist);
        const gmin = Math.max(H(camera.position.x, camera.position.z), 0) + 2; if (camera.position.y < gmin) camera.position.y = gmin;
        camera.lookAt(cx + Math.sin(yaw) * cp * 30, cy + Math.sin(pit) * 30, cz + Math.cos(yaw) * cp * 30);
    }
    if (shakeAmt > .02) { camera.position.x += rnd(-1, 1) * shakeAmt * .15; camera.position.y += rnd(-1, 1) * shakeAmt * .15; shakeAmt *= Math.pow(.02, dt); } else shakeAmt = 0;
    const fov = d.ln === 'a' && e.alive ? 70 + (e.speed - d.minSp) / (d.sp - d.minSp) * 8 : 68; if (Math.abs(camera.fov - fov) > .1) { camera.fov = fov; camera.updateProjectionMatrix(); }
    listenerPos = camera.position;
}
// ---------- one simulation step (also driven by HGNet.every while the host's tab is hidden) ----------
function simStep(dt) {
    simTime += dt;
    if (!M) return;
    for (const e of EN.values()) if (e.prot > 0) e.prot -= dt;
    if (!M.host) M.t += dt;
    if (ME && ME.alive) {
        const c = playerCtrl(ME, dt); stepVehicle(ME, c, dt);
        if (ME.crashed) { ME.crashed = false; ME.hp = 0; ME.lastBy = -1; }
        if (ME.hp <= 0 && !M.over) meDied(ME.lastBy !== undefined ? ME.lastBy : -1, ME.lastBy === -1 ? 'crash' : 'w1');
    } else if (ME) { ME.respT -= dt; }
    for (const e of EN.values()) {
        if (e === ME) continue;
        if (e.ai) { if (e.alive) aiStep(e, dt); } else if (e.alive) stepRemote(e, dt);
    }
    separate();
    updateProjectiles(dt);
    for (const e of EN.values()) if (e.alive) smokeDamaged(e, dt);
    if (M.host) hostStep(dt);
    sendT -= dt; if (sendT <= 0) { sendT = .06; sendState(); if (!M.host) flushHits(); }
    if (M.host) { bsT -= dt; if (bsT <= 0) { bsT = .1; sendBots(); } }
    else { hqT -= dt; if (hqT <= 0) { hqT = .12; flushHits(); } }
}
let lastAdv = performance.now();
function advance() {
    const now = performance.now(); const dt = Math.min(.1, (now - lastAdv) / 1000); lastAdv = now;
    if (M) simStep(dt);
    return dt;
}
// ---------- frame loop ----------
const FS = { n: 0, sum: 0, max: 0, over: 0, last: performance.now(), samples: [] };
let lastFrame = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const rdt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
    if (M) {
        const t0 = performance.now();
        const dt = advance(); updateParticles(dt); updateCamera(dt);
        waterTex.offset.x += dt * .004; waterTex.offset.y += dt * .002;
        if (Q.sh) { sun.position.set(camera.position.x + 180, camera.position.y + 300, camera.position.z + 110); sun.target.position.copy(camera.position); }
        renderer.render(scene, camera);
        UI.hud(rdt);
        if (ME) { if (ME.alive) engineSet(ME.def.ln === 'a' ? ME.thr : Math.abs(ME.speed) / ME.def.sp, ME.def.ln); else engineStop(); }
        autoQuality(now);
        // frame time stats
        const ft = now - FS.last; FS.last = now; if (ft < 1000) { FS.n++; FS.sum += ft; FS.max = Math.max(FS.max, ft); if (ft > 34) FS.over++; }
    } else {
        Lobby.render(rdt); FS.last = now;
    }
    saveT -= rdt; if (saveT <= 0) { saveT = 20; writeSave(); }
}
// drop the graphics quality by itself when the machine cannot keep up
const AQ = { t: 0, n: 0, sum: 0 };
function autoQuality(now) {
    const ft = now - FS.last; if (ft > 1000) return; AQ.n++; AQ.sum += ft;
    if (now - AQ.t > 5000) {
        if (AQ.t && AQ.n > 20 && AQ.sum / AQ.n > 42 && save.settings.quality !== 'low') { save.settings.quality = save.settings.quality === 'high' ? 'med' : 'low'; applyQuality(); writeSave(); toast('Graphics lowered to ' + save.settings.quality + ' for smoother play'); }
        AQ.t = now; AQ.n = AQ.sum = 0;
    }
}
// ---------- input ----------
function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'); }
function bindInput() {
    addEventListener('keydown', e => {
        if (typing(e)) return;
        IN.keys[e.code] = true;
        if (e.code === 'Tab' && M) { e.preventDefault(); UIS.board = true; }
        if (M && !e.repeat) {
            if (e.code === 'Escape' && !Cam.locked() && ME && ME.alive && !M.over && $('#s-pause').classList.contains('hidden') && $('#s-settings').classList.contains('hidden')) $('#s-pause').classList.remove('hidden');
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && M) e.preventDefault();
    });
    addEventListener('keyup', e => { IN.keys[e.code] = false; if (e.code === 'Tab') UIS.board = false; });
    addEventListener('blur', () => { IN.keys = {}; IN.mb = [0, 0, 0]; });
    addEventListener('mousedown', e => {
        if (!M || !ME) return;
        if (e.target.closest && e.target.closest('.scr:not(#s-dead),.dead-box')) { return; }
        if (!Cam.locked() && ME.alive && $('#s-pause').classList.contains('hidden')) { Cam.lock(); }
        IN.mb[e.button] = 1; ac();
    });
    addEventListener('mouseup', e => { IN.mb[e.button] = 0; });
    addEventListener('contextmenu', e => { if (M) e.preventDefault(); });
    addEventListener('wheel', e => { if (M) IN.zoom = clamp(IN.zoom + Math.sign(e.deltaY) * .1, .55, 2.2); }, { passive: true });
    addEventListener('mousemove', e => {
        if (!M || !ME || !ME.alive || !Cam.locked()) return;
        const s = .0022 * save.settings.sens, air = ME.def.ln === 'a';
        IN.camYaw -= e.movementX * s; IN.camPitch = clamp(IN.camPitch - e.movementY * s * (save.settings.invertY ? -1 : 1), air ? -1.3 : -.35, air ? 1.3 : .95);
    });
    document.addEventListener('pointerlockchange', () => {
        const l = Cam.locked(); $('#h-lock').classList.toggle('hidden', l || !M || !ME || !ME.alive);
        if (!l && M && !M.over && ME && ME.alive && $('#s-settings').classList.contains('hidden')) $('#s-pause').classList.remove('hidden');
    });
    addEventListener('resize', () => { applyQuality(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    addEventListener('beforeunload', () => { writeSave(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { IN.keys = {}; IN.mb = [0, 0, 0]; } });
}
// ---------- boot ----------
function boot() {
    try {
        save = loadSave(); applyQuality(); buildWorld(); initFx(); Lobby.init(); bindUI(); bindInput();
        camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
        UI.showMenu(); Lobby.refresh();
        hgLoad().then(HG => { if (HG && HG.every) HG.every(50, () => { if (document.hidden && M && M.host) advance(); }); });
        setTimeout(launcherBoot, 300);
        $('#boot').classList.add('hidden'); $('#menu').classList.remove('hidden');
        if (!save.seenHow) { save.seenHow = true; writeSave(); setTimeout(() => { if (!M) UI.open('s-how'); }, 400); }
        requestAnimationFrame(frame);
    } catch (e) { $('#boot-s').textContent = 'Could not start: ' + e.message; console.error(e); }
}
// ---------- debug hook for tests ----------
window.__steelstorm = {
    get state() { return M ? (M.over ? 'result' : 'match') : UIS.screen; },
    get save() { return save; }, get match() { return M; }, get me() { return ME; }, get party() { return PARTY; }, get net() { return PARTY.net; },
    get mode() { return M && M.mode; }, get tickets() { return M && M.tickets; }, get kills() { return M && M.kills; }, get points() { return M && M.pts; },
    ents() { return Array.from(EN.values()).map(e => ({ id: e.id, name: e.name, team: e.team, veh: e.def.id, x: +e.x.toFixed(1), y: +e.y.toFixed(1), z: +e.z.toFixed(1), hp: Math.round(e.hp), alive: e.alive, kills: e.kills, deaths: e.deaths, bot: !!e.isBot, remote: !!e.remote, ai: !!e.ai })); },
    ent(id) { return EN.get(id); }, get projectiles() { return PR.length; },
    VEHS, VBY, H, GH, PTS, QUAL, Lobby, BLD, EXT, ISL, UI, updateCamera, updateParticles,
    startMatch(o) {
        o = o || {}; const veh = o.veh || myVeh();
        const cfg = makeConfig([{ id: 0, name: myName(), veh }], o); beginMatch(cfg, 0, true); return cfg;
    },
    grant(o) { if (o.cr) save.credits += o.cr; if (o.rp) addRp(o.rp); if (o.free) save.freeRp += o.free; writeSave(); UI.wallet(); },
    research: { target: setTarget, free: spendFreeRp, canResearch, isResearched }, buy: buyVeh, lineup: lineupToggle, addRp, setTarget, buyVeh,
    press(code, down) { IN.keys[code] = down !== false; }, mouse(btn, down) { IN.mb[btn] = down === false ? 0 : 1; }, look(yaw, pitch) { if (yaw !== undefined) IN.camYaw = yaw; if (pitch !== undefined) IN.camPitch = pitch; },
    get cam() { return IN; }, get camera() { return camera; }, get renderer() { return renderer; },
    teleport(x, y, z, yaw) { if (!ME) return; ME.x = x; ME.z = z; ME.y = y === null || y === undefined ? GH(x, z) : y; if (yaw !== undefined) { ME.yaw = yaw; ME.tur = yaw; IN.camYaw = yaw; } },
    setVeh(id) { if (!ME) return; if (ME.alive) { ME.alive = false; } return respawnMe(id) || (ME.respT = 0, respawnMe(id)); },
    damage(id, n, by) { hostDamage(by === undefined ? (ME ? ME.id : 0) : by, id, n, 0, 'w1', true); },
    kill(id) { const e = EN.get(id); if (!e) return; e.hp = 0; if (e === ME) meDied(-1, 'x'); else if (M && M.host) hostKill(id, ME ? ME.id : -1, 'w1'); },
    end(win) { endMatch(win === undefined ? 0 : win); },
    step(n, dt) { for (let i = 0; i < n; i++) { simStep(dt || .033); updateParticles(dt || .033); } },
    fire(slot) { if (!ME) return false; ME[slot === 'w1' ? 't1' : slot === 'w2' ? 't2' : 't3'] = 0; return weaponFire(ME, slot, {}); },
    aim() { return ME && ME.alive ? aimRay(ME) : null; },
    perf() { const r = { frames: FS.n, avg: FS.n ? +(FS.sum / FS.n).toFixed(1) : 0, max: +FS.max.toFixed(1), over34: FS.over }; FS.n = FS.sum = FS.max = FS.over = 0; return r; },
    party_create: partyCreate, party_join: partyJoin, party_leave: partyLeave, play: startPlay,
    leave() { UI.leaveMatch(true); afterMatch(); },
    ui: { open: id => UI.open(id), showMenu: () => UI.showMenu(), paintResearch: () => UI.paintResearch() },
    T: { PR, makeConfig, hasLOS, newEnt, aiNew, spawnEnt, removeEnt, setDef, EN, IN, ballistic, pickSpawn, aiPickTarget, hostDamage, get save() { return save; } },
    compOf, myName, rosterNow, dump() { return JSON.stringify({ n: EN.size, pr: PR.length, t: M && Math.round(M.t) }); }
};
boot();
