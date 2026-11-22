// ============================================================
// More of a run: the four later classes' abilities (sentry gun, cluster charge, mark for death, dash), the sentry gun
// itself, the supply drop every fourth wave, the run that is kept when you leave
// (CONTINUE on the Holdout page), class levels, weekly contracts and prestige.
// ============================================================
const Extras = { meshes: [], M: new Float32Array(16) };
// ---- class levels: every run pays its experience to the class it was played as; a level is +1.5% damage and a
// slightly quicker ability, ten levels a class
Extras.clsLevel = function (id) { const c = Save.data.cls[id]; return c ? Math.min(10, Math.floor(Math.sqrt((c.xp || 0) / 250))) : 0; };
Extras.clsPay = function (id, xp) { const C = Save.data.cls, c = C[id] || (C[id] = { xp: 0, runs: 0 }), was = Extras.clsLevel(id); c.xp += xp; c.runs++; return Extras.clsLevel(id) > was; };
// what Game.stats adds for the later classes and class levels
Extras.stats = function (G, P) {
    const lvl = Extras.clsLevel(G.cls); P.dmgK *= 1 + 0.015 * lvl; if (G.cls === 'scout') P.speedK *= 1.1; if (P.stim > 0) P.speedK *= 1.3;
};
// X for the later classes. Returns true when it handled the class (the ability is then on its cooldown).
Extras.ability = function (G, P, c) {
    const d = G.dir;
    if (c === 'engineer') { Extras.turret(G, P.x + d[0] * 1.3, P.z + d[2] * 1.3, 25); return true; }
    if (c === 'demo') { const t = Math.min(40, World.ray(P.x, World.eye, P.z, d[0], d[1], d[2], 40)), tx = P.x + d[0] * t, tz = P.z + d[2] * t; for (let i = 0; i < 5; i++) G.falling.push({ x: tx + rand(-3.5, 3.5), z: tz + rand(-3.5, 3.5), t: 0.45 + i * 0.2, r: 4.6, dmg: 420 }); Snd.tone(1500, 0.2, 0.8, 'sine', 320); return true; }
    if (c === 'marksman') { let best = null, bs = 0; for (const e of Foes.list) { if (e.state === 'die' || e.born > 0) continue; const dist = Math.hypot(e.x - P.x, e.z - P.z); if (dist > 60 || !World.sees(P.x, P.z, e.x, e.z, 1.5)) continue; const s = e.max * (e.T.boss ? 3 : 1); if (s > bs) { bs = s; best = e; } } if (best) { best.marked = 10; best.flash = 1; HUD.feed('<b>MARKED</b> ' + esc(best.T.name)); } return true; }
    if (c === 'scout') { P.dash = 0.3; P.dashSafe = 0.5; Snd.noise(0.25, 3000, 600, 0.2); return true; }
    return false;
};

// ---- the sentry gun: three blocks (a base, a head that turns, a barrel), up to two standing at once
Extras.turret = function (G, x, z, secs) {
    if (World.blocked(x, z, 0.3)) { const f = World.free(x, z, 0.4); x = f[0]; z = f[1]; }
    if (!Extras.meshes.length) for (let i = 0; i < 2; i++) { const mat = HG3D.material({ color: 0x4b5243 }), dark = HG3D.material({ color: 0x1d1f1c }), set = [HG3D.mesh(HG3D.geo.box(0.55, 0.5, 0.55), mat), HG3D.mesh(HG3D.geo.box(0.42, 0.3, 0.6), mat), HG3D.mesh(HG3D.geo.box(0.09, 0.09, 0.7), dark)]; for (const m of set) { m.frustumCulled = false; m.visible = false; World.scene.add(m); } Extras.meshes.push(set); }
    if (G.turrets.length >= 2) G.turrets.shift(); G.turrets.push({ x, z, t: secs, yaw: Math.atan2(G.dir[0], G.dir[2]), cool: 0.5 }); HUD.callout('SENTRY GUN UP'); Snd.tone(220, 0.15, 0.3, 'square', 440);
};
Extras.step = function (dt, G) {
    const P = G.P;
    // sentry guns: turn to the nearest ashen they can see, and fire
    for (let i = G.turrets.length - 1; i >= 0; i--) { const t = G.turrets[i]; t.t -= dt; t.cool -= dt; if (t.t <= 0) { G.turrets.splice(i, 1); World.dust(t.x, 0.5, t.z, 5); continue; }
        if (G.mode === 'dm') continue; let best = null, bd = 26; for (const e of Foes.list) { if (e.state === 'die' || e.born > 0.3) continue; const d = Math.hypot(e.x - t.x, e.z - t.z); if (d < bd && World.sees(t.x, t.z, e.x, e.z, 1.1)) { bd = d; best = e; } }
        if (best) { let dy = Math.atan2(best.x - t.x, best.z - t.z) - t.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; t.yaw += clamp(dy, -dt * 5, dt * 5);
            if (Math.abs(dy) < 0.2 && t.cool <= 0) { t.cool = 0.13; Armory.hurt(G, best, 17 * P.dmgK); best.flash = Math.max(best.flash, 0.4); World.tracer(t.x + Math.sin(t.yaw) * 0.6, 1.05, t.z + Math.cos(t.yaw) * 0.6, best.x, 1.2 * best.size, best.z); if (Math.random() < 0.5) Snd.noise(0.1 * clamp(1.2 - Math.hypot(t.x - P.x, t.z - P.z) / 25, 0.1, 1), 5000, 900, 0.05); } } }
    // the stim wears off
    if (P.stim > 0) { P.stim -= dt; if (P.stim <= 0) Game.stats(); } if (P.dashSafe > 0) P.dashSafe -= dt;
    // the supply drop: walk onto it
    const S = G.supply; if (S && !P.dead && Math.hypot(P.x - S.x, P.z - S.z) < 1.8) { Marks.remove(S.mark); G.supply = null; for (const id in Gun.state) { const w = Gun.stats(id); Gun.state[id].ammo = w.mag; Gun.state[id].reserve = w.reserve; } P.armor = Math.min(150, P.armor + 50); G.nades = Math.min(THROWS[G.throwKind].n + 2, G.nades + 2); G.cash += 250; G.earned += 250; HUD.banner('SUPPLIES', 'ammunition, plates, throwables and $250'); Snd.ui('buy'); }
};
Extras.draw = function (G) {
    const e = Extras.M; for (let i = 0; i < Extras.meshes.length; i++) { const set = Extras.meshes[i], t = (G.turrets || [])[i]; for (const m of set) m.visible = !!t; if (!t) continue; const s = Math.sin(t.yaw), c = Math.cos(t.yaw);
        const put = (m, y, fwd) => { e.fill(0); e[0] = c; e[2] = -s; e[5] = 1; e[8] = s; e[10] = c; e[12] = t.x + s * fwd; e[13] = y; e[14] = t.z + c * fwd; e[15] = 1; HG3D.place(m, e); };
        e.fill(0); e[0] = e[5] = e[10] = e[15] = 1; e[12] = t.x; e[13] = 0.25; e[14] = t.z; HG3D.place(set[0], e); put(set[1], 0.72, 0.05); put(set[2], 0.74, 0.6); }
};
// the start of a run, after the kit
Extras.begin = function (G, P, o) {
    G.turrets = []; G.supply = null; P.stim = 0; P.dash = 0; P.dashSafe = 0;
    if (G.cls === 'demo') { G.nades++; G.blastK *= 1.15; }
    if (G.rule === 'sandbox') G.cash = 99999;
    if (o.resume && !G.net) Extras.resume(G, P, o.resume);
    Game.stats(); P.hp = o.resume ? Math.min(P.max, o.resume.hp || P.max) : P.max;
};
// a wave was cleared (alone, in a plain Holdout): every fourth brings a supply drop, and the run is kept
Extras.waveDone = function (G) {
    if (G.net || G.op || G.demo || G.mode !== 'holdout') return;
    if (G.wave % 4 === 0 && !G.supply) { const s = Ops.spot(G, 14, [], 10); G.supply = { x: s[0], z: s[1], mark: Marks.add(s[0], s[1], 1.6, [0.4, 0.75, 1.3], 20) }; HUD.feed('<b>SUPPLY DROP</b> under the blue light'); }
    if (G.rule !== 'sandbox') Extras.keep(G);
};
// ---- the run that is kept (single player): written when a wave is cleared and when the crate is shut
Extras.keep = function (G) {
    const P = G.P, guns = {}; for (const id in Gun.state) guns[id] = { lvl: Gun.state[id].lvl, ammo: Gun.state[id].ammo, reserve: Gun.state[id].reserve };
    Save.data.run = { map: World.id, diff: G.diff, cls: G.cls, rule: G.rule, wave: G.wave, cash: G.cash, earned: G.earned, kills: G.kills, heads: G.heads, xp: G.xpRun, time: G.time, perks: Object.assign({}, G.perks), armor: P.armor, hp: P.hp, nades: G.nades, slots: Gun.slots.slice(), guns, slot: G.slot, fired: G.shotsFired, hit: G.shotsHit }; Save.store();
};
Extras.drop = function () { if (Save.data.run) { Save.data.run = null; Save.store(); } };
Extras.resume = function (G, P, r) {
    G.wave = r.wave; G.cash = r.cash; G.earned = r.earned || 0; G.kills = r.kills || 0; G.heads = r.heads || 0; G.xpRun = r.xp || 0; G.time = r.time || 0; G.shotsFired = r.fired || 0; G.shotsHit = r.hit || 0; Object.assign(G.perks, r.perks || {}); P.armor = r.armor || 0; G.nades = r.nades === undefined ? G.nades : r.nades; G.phaseT = 8;
    const slots = (r.slots || []).map(id => id && Gun.models[id] && WEAPONS[id] ? id : null); if (slots.some(Boolean)) { const lv = {}; for (const id of slots) if (id) lv[id] = (r.guns[id] || {}).lvl || 0; Gun.reset(slots, lv); for (const id of slots) if (id && r.guns[id]) { Gun.state[id].ammo = Math.min(Gun.stats(id).mag, r.guns[id].ammo); Gun.state[id].reserve = r.guns[id].reserve; } G.slot = Gun.slots[r.slot] ? r.slot : Gun.slots.findIndex(Boolean); G.lastSlot = G.slot; Gun.equip(Gun.slots[G.slot], P); }
    HUD.banner('WAVE ' + (r.wave + 1) + ' NEXT', 'picked up where you left off');
};
// ---- weekly contracts and prestige (the armory's CONTRACTS page shows them)
Extras.week = function () { const d = new Date(), a = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-w' + Math.ceil(((d - a) / 86400000 + a.getDay() + 1) / 7); };
Extras.weekly = function () {
    const C = Save.data.contracts, wk = Extras.week();
    if (C.week !== wk || !C.wlist || C.wlist.length !== 3) { let s = 7; for (const ch of wk) s = (s * 33 + ch.charCodeAt(0)) >>> 0; const pick = [], seen = {}; let guard = 0; while (pick.length < 3 && guard++ < 300) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const i = s % JOBS.length, key = JOBS[i][0].split(':')[0]; if (seen[key] || key === 'wave' || key === 'ops' || key === 'mp') continue; seen[key] = 1; pick.push(i); } C.week = wk; C.wlist = pick.map(i => ({ job: i, have: 0, paid: false })); Save.store(); }
    return C.wlist;
};
Extras.wNeed = c => JOBS[c.job][1] * 6; Extras.wPay = c => JOBS[c.job][2] * 4;
Extras.note = function (k, n) { for (const c of Extras.weekly()) if (JOBS[c.job][0] === k && !c.paid) c.have += n; };
Extras.wReady = () => Extras.weekly().filter(c => !c.paid && c.have >= Extras.wNeed(c)).length;
Extras.jobsHTML = function () {
    const sv = Save.data, r = Save.rank(), top = r.index >= RANKS.length - 1;
    return '<div class="h3" style="margin-top:20px">This week&rsquo;s contracts &middot; bigger jobs, bigger pay</div>' + Extras.weekly().map((c, i) => { const J = JOBS[c.job], need = Extras.wNeed(c), done = c.have >= need; return '<div class="job' + (c.paid ? ' paid' : '') + '"><div><b>' + esc(J[3].replace(String(J[1]), String(need))) + '</b><div class="xp"><i style="width:' + (clamp(c.have / need, 0, 1) * 100).toFixed(0) + '%"></i></div><small>' + Math.min(c.have, need) + ' / ' + need + '</small></div><button class="btn' + (done && !c.paid ? ' go' : '') + '" data-ar="wclaim:' + i + '"' + (done && !c.paid ? '' : ' disabled') + '>' + (c.paid ? 'PAID' : Extras.wPay(c) + ' CR') + '</button></div>'; }).join('') +
        '<div class="h3" style="margin-top:20px">Prestige ' + (sv.prestige ? '&#9733;'.repeat(Math.min(10, sv.prestige)) : '') + '</div><div class="job"><div><b>' + (top ? 'You have reached the last rank.' : 'Reach the last rank, ' + RANKS[RANKS.length - 1] + ', to prestige.') + '</b><small style="display:block;margin-top:4px">Prestige takes your rank back to the first and keeps everything you own. Each prestige is a star by your name, 1000 credits now and 10% more credits from then on.</small></div><button class="btn' + (top ? ' go' : '') + '" data-ar="prestige:1"' + (top ? '' : ' disabled') + '>PRESTIGE</button></div>';
};
Extras.click = function (k, id) {
    const sv = Save.data;
    if (k === 'wclaim') { const c = Extras.weekly()[+id]; if (!c || c.paid || c.have < Extras.wNeed(c)) return false; c.paid = true; Armory.earn(Extras.wPay(c)); Snd.ui('buy'); Snd.tone(440, 0.2, 0.5, 'triangle', 880); return true; }
    if (k === 'prestige') { if (Save.rank().index < RANKS.length - 1) return false; sv.xp = 0; sv.prestige = (sv.prestige || 0) + 1; sv.credits = (sv.credits || 0) + 1000; Snd.boom(0.6); Snd.tone(330, 0.3, 1.2, 'triangle', 1320); return true; }
    return false;
};
