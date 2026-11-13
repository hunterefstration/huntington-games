// ============================================================
// INPUT, CAMERA, THE MAIN LOOP, BOOT, and the debug hook window.__steelstorm
// ============================================================
const IN = { keys: {}, mb: [0, 0, 0], camYaw: 0, camPitch: .2, zoom: 1 };
const Cam = {
    aimD: 0, aim: { x: 0, y: 0, z: 0 }, deadYaw: 0, specId: -1, solOk: true, mlock: null,
    reset() { if (!ME) return; IN.camYaw = ME.yaw; IN.camPitch = ME.def.ln === 'a' && !ME.def.heli ? 0.05 : 0.22; IN.zoom = 1; },
    lock() { try { const r = $('#gl').requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} },
    locked() { return document.pointerLockElement === $('#gl'); }
};
// where to aim to hit a moving target o with a shot of speed v fired from `from` (the shooter's own speed adds to bullets/rockets in the air)
function leadPoint(e, o, v, from) {
    const air = o.def.ln === 'a', cy = o.y + (air ? 0 : 1.5), fixed = e.def.ln === 'a' && !e.def.heli, sp = Math.max(60, v * (fixed ? 1 : .97) + (fixed ? e.speed * .9 : 0));
    let px = o.x, py = cy, pz = o.z;
    for (let i = 0; i < 3; i++) { const tt = Math.hypot(px - from.x, py - from.y, pz - from.z) / sp; px = o.x + o.vx * tt; py = cy + (air ? o.vy * tt : 0); pz = o.z + o.vz * tt; }
    return { x: px, y: py, z: pz };
}
function aimRay(e) {
    camera.getWorldDirection(V3); const dx = V3.x, dy = V3.y, dz = V3.z, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    let t = 1500;
    for (let s = 20; s < 1500; s += 6) { if (oy + dy * s < GHS(ox + dx * s, oz + dz * s)) { let lo = s - 6, hi = s; for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (oy + dy * m < GHS(ox + dx * m, oz + dz * m)) hi = m; else lo = m; } t = hi; break; } }
    let best = null, bt = t;
    for (const o of EN.values()) {
        if (!o.alive || !foe(o, e) || hiddenSub(o)) continue;
        const cy = o.y + (o.def.ln === 'a' ? 0 : 1.5), vx = o.x - ox, vy = cy - oy, vz = o.z - oz, tt = vx * dx + vy * dy + vz * dz;
        if (tt < 8 || tt > bt) continue;
        const px = ox + dx * tt - o.x, py = oy + dy * tt - cy, pz = oz + dz * tt - o.z;
        if (Math.sqrt(px * px + py * py + pz * pz) < o.def.r * 1.8 + tt * .02) { best = o; bt = tt; }
    }
    Cam.lead = null;
    if (best && !e.def.w1.arty) { const lp = leadPoint(e, best, e.def.w1.v || 200, e.mdl ? muzzleWorld(e, 0) : e); Cam.lead = { x: lp.x, y: lp.y, z: lp.z, id: best.id, D: bt }; return lp; }
    return { x: ox + dx * t, y: oy + dy * t, z: oz + dz * t };
}
// missile lock: the enemy nearest the reticle (within ~14 degrees) that this missile can chase
function missileLock(e, w) {
    if (!w || w.k !== 'missile') return null;
    camera.getWorldDirection(V3); let best = null, ba = .25;
    for (const o of EN.values()) {
        if (!o.alive || !foe(o, e) || hiddenSub(o)) continue;
        if (w.air && o.def.ln !== 'a') continue; if (w.sea && o.def.ln !== 'n') continue; if (!w.air && !w.sea && o.def.ln === 'a' && !o.def.heli) continue;
        const vx = o.x - camera.position.x, vy = o.y - camera.position.y, vz = o.z - camera.position.z, L = Math.hypot(vx, vy, vz); if (L < 30 || L > 1100) continue;
        const a = Math.acos(clamp((vx * V3.x + vy * V3.y + vz * V3.z) / L, -1, 1)); if (a < ba) { ba = a; best = o; }
    }
    return best;
}
const PC = { thr: 0, steer: 0, side: 0, up: 0, aimYaw: 0, aimPitch: 0, f1: false, f2: false, f3: false, tgt: -1, bodyYaw: undefined };
function playerCtrl(e, dt) {
    const k = IN.keys, d = e.def, c = PC;
    c.thr = 0; c.steer = 0; c.side = 0; c.up = 0; c.aimYaw = e.tur; c.aimPitch = 0; c.f1 = !!IN.mb[0]; c.f2 = !!(IN.mb[2] || k.Space); c.f3 = !!(k.KeyB || k.ShiftLeft || k.ShiftRight); c.tgt = -1; c.bodyYaw = undefined;
    const W = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), A = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    const mw = [d.w1, d.w2, d.w3].find(w => w && w.k === 'missile'), ml = missileLock(e, mw); Cam.mlock = ml;
    if (d.ln === 'a' && !d.heli) {
        e.thr = clamp(e.thr + W * dt * .6, 0, 1); c.thr = e.thr;
        IN.camYaw += A * dt * 1.5; IN.camPitch = clamp(IN.camPitch + ((k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)) * dt * .9, -1.3, 1.3);
        c.aimYaw = IN.camYaw; c.aimPitch = IN.camPitch;
        // soft aim assist: an enemy near the reticle pulls the nose onto its lead point, so the guns (which converge there) can hit
        Cam.lead = null; camera.getWorldDirection(V3);
        const dx = V3.x, dy = V3.y, dz = V3.z, ox = camera.position.x, oy = camera.position.y, oz = camera.position.z; let bestA = .07;
        for (const o of EN.values()) {
            if (!o.alive || !foe(o, e) || hiddenSub(o)) continue;
            const vx = o.x - ox, vy = o.y - oy, vz = o.z - oz, L = Math.hypot(vx, vy, vz); if (L < 40 || L > 800) continue;
            const ang = Math.acos(clamp((vx * dx + vy * dy + vz * dz) / L, -1, 1));
            if (ang < bestA) { bestA = ang; const lp = leadPoint(e, o, d.w1.v, e); Cam.lead = { x: lp.x, y: lp.y, z: lp.z, id: o.id, D: Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) }; }
        }
        if (Cam.lead) { const lx = Cam.lead.x - e.x, ly = Cam.lead.y - e.y, lz = Cam.lead.z - e.z; c.aimYaw = Math.atan2(lx, lz); c.aimPitch = Math.atan2(ly, Math.hypot(lx, lz)); }
    } else {
        if (d.heli) { c.thr = W; c.side = A; c.up = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0); c.bodyYaw = IN.camYaw; }
        else if (d.ln === 'n') { e.thr = clamp(e.thr + W * dt * .45, -.45, 1); c.thr = e.thr; c.steer = -A; } else { c.thr = W; c.steer = -A; }
        const p = aimRay(e), m = muzzleWorld(e, 0), w = d.w1, far = Math.hypot(p.x - m.x, p.z - m.z);
        const b = w.k === 'missile' ? { yaw: Math.atan2(p.x - m.x, p.z - m.z), pitch: Math.atan2(p.y - m.y, far), ok: true } : ballistic(m.x, m.y, m.z, p.x, p.y, p.z, w.v, w.g, !!w.arty && far > 220);
        Cam.aimD = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z); Cam.aim.x = p.x; Cam.aim.y = p.y; Cam.aim.z = p.z; Cam.solOk = b.ok; c.aimYaw = b.yaw; c.aimPitch = b.pitch;
    }
    if (ml) c.tgt = ml.id; else if (Cam.lead) c.tgt = Cam.lead.id;
    return c;
}
function nextSpec(step) {
    const L = Array.from(EN.values()).filter(o => o.alive && o !== ME && (M.mode === 'ffa' || !foe(o, ME) || o.id === UIS.spec));
    const all = L.length ? L : Array.from(EN.values()).filter(o => o.alive && o !== ME); if (!all.length) { Cam.specId = -1; return; }
    const i = all.findIndex(o => o.id === Cam.specId); Cam.specId = all[(i + (step || 1) + all.length) % all.length].id;
}
function updateCamera(dt) {
    if (!ME) return;
    const e = ME; let yaw = IN.camYaw, pit = IN.camPitch;
    const d = e.def;
    if (!e.alive) {
        let t = EN.get(Cam.specId); if (UIS.spec >= 0 && Cam.specId !== UIS.spec && EN.get(UIS.spec) && EN.get(UIS.spec).alive && !t) { Cam.specId = UIS.spec; t = EN.get(UIS.spec); }
        if (!t || !t.alive) { if (simTime - (e.dieT || 0) > 2.5 || !e.dieT) { nextSpec(1); t = EN.get(Cam.specId); } }
        const f = t && t.alive ? t : e;
        Cam.deadYaw += dt * .3; yaw = Cam.deadYaw; pit = .4; const dist = f === e ? 40 : f.def.cd * 1.3, cx = f.x, cy = f.y + 4, cz = f.z;
        camera.position.set(cx - Math.sin(yaw) * Math.cos(pit) * dist, cy + Math.sin(pit) * dist, cz - Math.cos(yaw) * Math.cos(pit) * dist);
        const gmin = Math.max(H(camera.position.x, camera.position.z), 0) + 2; if (camera.position.y < gmin) camera.position.y = gmin;
        camera.lookAt(cx, cy, cz);
    } else {
        Cam.deadYaw = yaw; Cam.specId = -1;
        const cp = Math.cos(pit), dist = d.cd * IN.zoom * (d.w1.arty ? 1.2 : 1), lift = d.ln === 'a' ? 3 : d.ln === 'n' ? 6 : 3.2;
        const cx = e.x, cy = e.y + lift - (d.sub ? e.dive * 3 : 0), cz = e.z;
        camera.position.set(cx - Math.sin(yaw) * cp * dist, cy - Math.sin(pit) * dist, cz - Math.cos(yaw) * cp * dist);
        const gmin = Math.max(H(camera.position.x, camera.position.z), 0) + 2; if (camera.position.y < gmin) camera.position.y = gmin;
        camera.lookAt(cx + Math.sin(yaw) * cp * 30, cy + Math.sin(pit) * 30, cz + Math.cos(yaw) * cp * 30);
    }
    if (shakeAmt > .02) { camera.position.x += rnd(-1, 1) * shakeAmt * .15; camera.position.y += rnd(-1, 1) * shakeAmt * .15; shakeAmt *= Math.pow(.02, dt); } else shakeAmt = 0;
    const fov = d.ln === 'a' && !d.heli && e.alive ? 70 + (e.speed - d.minSp) / (d.sp - d.minSp) * 8 : 68; if (Math.abs(camera.fov - fov) > .1) { camera.fov = fov; camera.updateProjectionMatrix(); }
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
        if (ME.crashed) { ME.crashed = false; meDied(-1, 'crash'); }
    } else if (ME) { ME.respT -= dt; }
    for (const e of EN.values()) {
        if (e === ME) continue;
        if (e.ai) { if (e.alive) aiStep(e, dt); } else if (e.alive) stepRemote(e, dt);
    }
    separate();
    if (M.host && netOn()) recordHistory();
    updateProjectiles(dt);
    for (const e of EN.values()) if (e.alive) smokeDamaged(e, dt);
    if (M.host) hostStep(dt);
    sendT -= dt; if (sendT <= 0) { sendT = .06; sendState(); if (!M.host) flushHits(); }
    if (M.host) { bsT -= dt; if (bsT <= 0) { bsT = .1; sendBots(); } }
    else { hqT -= dt; if (hqT <= 0) { hqT = .12; flushHits(); } pgT -= dt; if (pgT <= 0 && netOn()) { pgT = 1; PARTY.net.send('host', { t: 'pg', c: performance.now() }, { fast: true }); } }
}
let lastAdv = performance.now();
function advance() {
    const now = performance.now(); const dt = Math.min(.1, (now - lastAdv) / 1000); lastAdv = now;
    if (M) simStep(dt);
    return dt;
}
// ---------- frame loop ----------
const FS = { n: 0, sum: 0, max: 0, over: 0, last: performance.now(), rsum: 0 };
const DBG = { noRender: false, autoQ: true };
let lastFrame = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const rdt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
    if (M) {
        const dt = advance(); updateParticles(dt); updateCamera(dt); updateWorld(dt); updateFlagViz();
        if (!DBG.noRender) { const r0 = performance.now(); renderer.render(scene, camera); FS.rsum += performance.now() - r0; }
        UI.hud(rdt);
        if (ME) { if (ME.alive) engineSet(ME.def.ln === 'a' && !ME.def.heli ? ME.thr : Math.abs(ME.speed) / ME.def.sp, ME.def.ln); else engineStop(); }
        if (DBG.autoQ && !DBG.noRender) autoQuality(now);
        const ft = now - FS.last; FS.last = now; if (ft < 1000) { FS.n++; FS.sum += ft; FS.max = Math.max(FS.max, ft); if (ft > 34) FS.over++; }
    } else {
        if (!DBG.noRender) Lobby.render(rdt); FS.last = now;
    }
    saveT -= rdt; if (saveT <= 0) { saveT = 20; writeSave(); }
}
function updateFlagViz() {
    if (!M || M.mode !== 'ctf') return;
    M.flags.forEach((f, i) => { const v = flagViz[i]; if (!v) return; const c = f.st === 'carry' ? EN.get(f.by) : null; v.grp.position.set(f.x, c ? c.y + 3 : GH(f.x, f.z), f.z); v.cloth.rotation.y = Math.sin(simTime * 3 + i) * .3; });
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
            if (e.code === 'KeyC' && ME && ME.alive && ME.def.sub) { ME.diveOn = !ME.diveOn; toast(ME.diveOn ? 'Diving: only torpedoes can hit you, guns are off' : 'Surfacing'); }
            if (e.code === 'KeyF' && ME && ME.alive) { if (!dropFlares(ME) && !ME.def.flares && ME.def.ln === 'a') toast('Research the Countermeasures module for flares'); }
            if (e.code === 'Enter' && PARTY.net) { e.preventDefault(); const i = $('#h-say'); i.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => i.focus(), 0); IN.keys = {}; }
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && M) e.preventDefault();
    });
    addEventListener('keyup', e => { IN.keys[e.code] = false; if (e.code === 'Tab') UIS.board = false; });
    addEventListener('blur', () => { IN.keys = {}; IN.mb = [0, 0, 0]; });
    addEventListener('mousedown', e => {
        if (!M || !ME) return;
        if (e.target.closest && e.target.closest('.scr:not(#s-dead),.dead-box,#h-say')) { return; }
        if (!ME.alive && !M.over) { nextSpec(1); return; }
        if (!Cam.locked() && ME.alive && $('#s-pause').classList.contains('hidden')) { Cam.lock(); }
        IN.mb[e.button] = 1; ac();
    });
    addEventListener('mouseup', e => { IN.mb[e.button] = 0; });
    addEventListener('contextmenu', e => { if (M) e.preventDefault(); });
    addEventListener('wheel', e => { if (M) IN.zoom = clamp(IN.zoom + Math.sign(e.deltaY) * .1, .55, 2.2); }, { passive: true });
    addEventListener('mousemove', e => {
        if (!M || !ME || !ME.alive || !Cam.locked()) return;
        const s = .0022 * save.settings.sens, air = ME.def.ln === 'a' && !ME.def.heli;
        IN.camYaw -= e.movementX * s; IN.camPitch = clamp(IN.camPitch - e.movementY * s * (save.settings.invertY ? -1 : 1), air ? -1.3 : -.35, air ? 1.3 : (ME.def.heli ? 1.2 : .95));
    });
    document.addEventListener('pointerlockchange', () => {
        const l = Cam.locked(); $('#h-lock').classList.toggle('hidden', l || !M || !ME || !ME.alive);
        if (!l && M && !M.over && ME && ME.alive && $('#s-settings').classList.contains('hidden') && $('#h-say').classList.contains('hidden')) $('#s-pause').classList.remove('hidden');
    });
    addEventListener('resize', () => { applyQuality(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    addEventListener('beforeunload', () => { writeSave(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { IN.keys = {}; IN.mb = [0, 0, 0]; } });
}
// ---------- boot ----------
function boot() {
    try {
        save = loadSave(); applyQuality(); buildWorld(); applyWeather('noon'); applyQuality(); initFx(); Lobby.init(); bindUI(); bindInput();
        camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
        UI.showMenu(); Lobby.refresh();
        hgLoad().then(HG => { if (HG && HG.every) HG.every(50, () => { if (document.hidden && M && M.host) advance(); }); });
        setTimeout(launcherBoot, 300);
        $('#boot').classList.add('hidden'); $('#menu').classList.remove('hidden');
        if (!save.seenHow) { save.seenHow = true; save.seenNew = VERSION; writeSave(); setTimeout(() => { if (!M) UI.open('s-how'); }, 400); }
        else if (save.seenNew !== VERSION) { save.seenNew = VERSION; writeSave(); setTimeout(() => { if (!M) UI.open('s-new'); }, 400); }
        requestAnimationFrame(frame);
    } catch (e) { $('#boot-s').textContent = 'Could not start: ' + e.message; console.error(e); }
}
// ---------- debug hook for tests ----------
function renderStats(n) {      // render n frames now and report the cost and renderer.info
    const gl = renderer.getContext(), t0 = performance.now(); let calls = 0, tris = 0;
    for (let i = 0; i < (n || 1); i++) { if (M) { updateWorld(.016); renderer.render(scene, camera); } else Lobby.render(.016); calls = renderer.info.render.calls; tris = renderer.info.render.triangles; }
    const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { calls, tris, ms: +((performance.now() - t0) / (n || 1)).toFixed(1), programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
}
window.__steelstorm = {
    version: VERSION,
    get state() { return M ? (M.over ? 'result' : 'match') : UIS.lobby && PARTY.code ? 'lobby' : UIS.screen; },
    get save() { return save; }, get match() { return M; }, get me() { return ME; }, get party() { return PARTY; }, get net() { return PARTY.net; },
    get mode() { return M && M.mode; }, get tickets() { return M && M.tickets; }, get kills() { return M && M.kills; }, get points() { return M && M.pts; }, get flags() { return M && M.flags; }, get weather() { return WXK; },
    ents() { return Array.from(EN.values()).map(e => ({ id: e.id, name: e.name, team: e.team, veh: e.def.id, mask: e.def.mask | 0, x: +e.x.toFixed(1), y: +e.y.toFixed(1), z: +e.z.toFixed(1), hp: Math.round(e.hp), alive: e.alive, kills: e.kills, deaths: e.deaths, score: Math.round(e.score), bot: !!e.isBot, remote: !!e.remote, ai: !!e.ai, dive: e.dive, carry: e.carry, sb: e.sb.length, stale: !!e.stale })); },
    ent(id) { return EN.get(id); }, get projectiles() { return PR.length; }, clk() { const o = {}; for (const k in CLK) o[k] = { delay: Math.round(CLK[k].delay), jit: Math.round(CLK[k].jit), jv: Math.round(CLK[k].jv), iv: Math.round(CLK[k].iv) }; return o; },
    VEHS, VBY, MODS, MODBY, BRANCHES, H, GH, PTS, QUAL, WX, Lobby, BLD, EXT, ISL, UI, updateCamera, updateParticles, vdef, brOf, modMask,
    startMatch(o) {
        o = o || {}; const veh = o.veh || myVeh();
        const cfg = makeConfig([{ id: 0, name: myName(), veh, mm: o.mm !== undefined ? o.mm : modMask(veh) }], o); beginMatch(cfg, 0, true); return cfg;
    },
    grant(o) { if (o.cr) save.credits += o.cr; if (o.rp) addRp(o.rp); if (o.free) save.freeRp += o.free; writeSave(); UI.wallet(); },
    research: { target: setTarget, free: spendFreeRp, canResearch, isResearched }, buy: buyVeh, lineup: lineupToggle, addRp, setTarget, buyVeh,
    press(code, down) { IN.keys[code] = down !== false; }, mouse(btn, down) { IN.mb[btn] = down === false ? 0 : 1; }, look(yaw, pitch) { if (yaw !== undefined) IN.camYaw = yaw; if (pitch !== undefined) IN.camPitch = pitch; },
    get cam() { return IN; }, get camera() { return camera; }, get renderer() { return renderer; },
    teleport(x, y, z, yaw) { if (!ME) return; ME.x = x; ME.z = z; ME.y = y === null || y === undefined ? GH(x, z) : y; if (yaw !== undefined) { ME.yaw = yaw; ME.tur = yaw; IN.camYaw = yaw; } },
    setVeh(id, mm) { if (!ME) return; if (ME.alive) { ME.alive = false; } ME.respT = 0; const ok = respawnMe(id); if (ok && mm !== undefined) { setDef(ME, vdef(id, mm)); spawnEnt(ME); } return ok; },
    damage(id, n, by) { hostDamage(by === undefined ? (ME ? ME.id : 0) : by, id, n, 0, 'w1', true); },
    kill(id) { const e = EN.get(id); if (!e) return; if (M && M.host) hostKill(id, ME && id !== ME.id ? ME.id : -1, 'w1'); },
    end(win) { endMatch(win === undefined ? 0 : win); },
    step(n, dt) { for (let i = 0; i < n; i++) { simStep(dt || .033); updateParticles(dt || .033); } updateFlagViz(); },
    fire(slot) { if (!ME) return false; ME[slot === 'w1' ? 't1' : slot === 'w2' ? 't2' : 't3'] = 0; return weaponFire(ME, slot, PC); },
    aim() { return ME && ME.alive ? aimRay(ME) : null; },
    perf() { const r = { frames: FS.n, avg: FS.n ? +(FS.sum / FS.n).toFixed(1) : 0, max: +FS.max.toFixed(1), over34: FS.over, render: FS.n ? +(FS.rsum / FS.n).toFixed(1) : 0 }; FS.n = FS.sum = FS.max = FS.over = FS.rsum = 0; return r; },
    noRender(v) { DBG.noRender = v !== false; }, autoQ(v) { DBG.autoQ = !!v; },
    setQuality(q) { save.settings.quality = q; applyQuality(); return Q; }, setWeather(k) { return applyWeather(k); },
    renderStats,
    buildAll() {      // every vehicle, both team paints, every module combination's kit: report problems
        const out = { n: 0, errors: [], parts: {} };
        for (const v of VEHS) for (const t of [0, 1]) {
            try { const m = makeModel(vdef(v.id, 31), t, 42); let meshes = 0, tris = 0; m.root.traverse(o => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); if (t === 0) out.parts[v.id] = { meshes, tris: Math.round(tris) }; disposeModel(m); out.n++; if (!m.muzzles.length) out.errors.push(v.id + ': no muzzle'); }
            catch (er) { out.errors.push(v.id + ': ' + er.message); }
        }
        return out;
    },
    party_create: partyCreate, party_join: partyJoin, party_leave: partyLeave, play: startPlay, ready: partyReady, team: partyTeam, chat: sendChat, kick: partyKick, shuffle: partyShuffle, balance: partyBalance,
    impair(o) { if (PARTY.net) PARTY.net.setImpairment(o); },
    leave() { UI.leaveMatch(true); afterMatch(); },
    ui: { open: id => UI.open(id), showMenu: () => UI.showMenu(), paintResearch: () => UI.paintResearch(), openLobby: () => UI.openLobby() },
    T: { PR, makeConfig, hasLOS, newEnt, aiNew, spawnEnt, removeEnt, setDef, EN, IN, ballistic, pickSpawn, aiPickTarget, hostDamage, syncState, applySync, CLK, get save() { return save; } },
    compOf, myName, rosterNow, dump() { return JSON.stringify({ n: EN.size, pr: PR.length, t: M && Math.round(M.t) }); }
};
boot();
