// ============================================================
// THE BATTLE. Three kinds (MODES in 12-data.js):
//   waves   the proving ground: your tank against waves of others, a field upgrade after each
//   tdm     team battle: two platoons, crews come back in a new tank, first side to enough kills
//   conq    conquest: three rings to hold; the side holding fewer loses tickets
// Aiming is a line of sight you turn with the mouse (left/right and up/down); where it meets the ground or a tank is the
// aim point, the turret and gun follow at their own speed, and a ring shows where the gun as it points now would really
// land its shell. Every battle pays research points and credits (Game.pay).
// ============================================================
const HUD = { last: {},
    set(id, v, prop) { const k = id + (prop || ''); if (this.last[k] === v) return false; this.last[k] = v; const el = $(id); if (prop === 'w') el.style.width = v; else if (prop === 'o') el.style.opacity = v; else if (prop === 'c') el.className = v; else if (prop === 'h') el.innerHTML = v; else el.textContent = v; return true; },
    reset() { this.last = {}; $('score').className = 'hidden'; $('cap').className = 'hidden'; $('feed').innerHTML = ''; $('banner').className = ''; $('callout').className = ''; this.set('msg', ''); this.set('prompt', ''); this.set('hurt', 0, 'o'); $('marks').innerHTML = ''; $('scores').classList.add('hidden'); delete $('hud').dataset.sight; },
    banner(text, sub) { const b = $('banner'); b.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : ''); b.className = ''; void b.offsetWidth; b.className = 'show'; },
    callout(text) { const b = $('callout'); b.textContent = text; b.className = ''; void b.offsetWidth; b.className = 'show'; },
    feed(html) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = html; f.appendChild(d); while (f.children.length > 5) f.removeChild(f.firstChild); setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4000); },
    hit(kill) { const h = $('hit'); h.className = kill ? 'kill' : ''; h.style.transition = 'none'; h.style.opacity = 1; h.style.transform = 'rotate(45deg) scale(' + (kill ? 1.5 : 1) + ')'; void h.offsetWidth; h.style.transition = 'opacity .3s'; h.style.opacity = 0; },
    from(dx, dz, yaw) { const a = Math.atan2(dx, dz) - yaw, el = $('dmg-dir'); el.style.transition = 'none'; el.style.transform = 'rotate(' + (a).toFixed(2) + 'rad)'; el.style.opacity = 1; void el.offsetWidth; el.style.transition = 'opacity 1.2s'; el.style.opacity = 0; } };
const Game = { over: false, shopOpen: false }, TV = { e: [0, 0, 0], d: [0, 0, 1] }, GF = [0, 0, 0];
const SIDE = ['OLIVE', 'SAND'];
// nothing solid within `room` metres of a spot
Game.clear = function (x, z, room) { const r = room || 8; if (!World.inside(x, z)) return false; for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) if (World.solid(x + dx, z + dz)) return false; return true; };
// the nearest clear spot to a point (a spiral out from it), away from every tank on the field
Game.spot = function (x, z, room) { for (let r = 0; r < 90; r += 4) for (let a = 0; a < 6.28; a += 0.5) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (Game.clear(px, pz, room) && !Units.list.some(U => !U.dead && Math.hypot(U.x - px, U.z - pz) < 10)) return [px, pz]; if (!r) break; } return [x, z]; };
// o = { mode, veh | cls, size, skill }
Game.start = function (o) {
    const G = Game; o = o || G.last || {}; G.last = o; G.mode = MODES[o.mode] ? o.mode : 'waves'; G.teams = G.mode !== 'waves';
    G.cls = VEHS[o.veh] ? o.veh : KINDS[o.cls] ? o.cls : (G.cls || 'medium'); G.mods = VEHS[G.cls] ? Save.data.mods[G.cls] : null;
    Units.clear(); World.smoke.clear(); World.fire.clear(); HUD.reset(); Beams.clear();
    Object.assign(G, { wave: 0, phase: 'break', phaseT: 4, upT: 0, shopOpen: false, score: 0, kills: 0, deaths: 0, shots: 0, hits: 0, dealt: 0, caps: 0, kits: 2, time: 0, over: false, overT: 0, shown: false, aimPitch: -0.04, sight: 0, aimHit: false, ax: 0, ay: 0, az: 0, shakeK: 0, hurt: 0, frame: 0, ups: [], roster: [], points: [], backT: 0 });
    G.targetFor = G.teams ? Game.targetFor : null; G.goalFor = G.teams ? Game.goalFor : null;
    if (G.teams) Game.startTeams(o);
    else {
        // a clear place to start: spiral out from the middle, facing the longest clear run from there
        const s = Game.spot(World.mid[0], World.mid[1]); let yaw0 = 0, run = -1; for (let a = 0; a < 6.28; a += 0.3927) { let d = 0; while (d < 80 && !World.solid(s[0] + Math.sin(a) * d, s[1] + Math.cos(a) * d) && World.inside(s[0] + Math.sin(a) * d, s[1] + Math.cos(a) * d)) d += 2; if (d > run) { run = d; yaw0 = a; } }
        const P = G.P = Units.make(0, s[0], s[1], yaw0, G.cls, G.mods); P.reload = 0; G.aimYaw = yaw0;
    }
    Units.place(G.P); Game.eye(); Game.aim(); Input.aimOn = false;
    $('hud').dataset.mode = 'tank'; Game.hud(); Game.hint(); Music.set('fight'); Save.data.stats.games++; Save.store();
};
Game.stop = function () { HUD.reset(); delete $('hud').dataset.mode; Units.clear(); Beams.clear(); Music.set('menu'); };
Game.hint = function () { if (App.game !== Game) return; HUD.set('msg', Game.over ? '' : (!App.locked && !App.paused ? 'CLICK TO FIGHT' : '')); };
Game.statLine = () => Units.list.length + ' tanks, ' + Units.shells.length + ' shells';
Game.enemies = () => Units.list.filter(U => U.team !== 0 && !U.dead);

// ---- team battles
Game.startTeams = function (o) {
    const G = Game, size = clamp(o.size | 0 || 5, 2, 6), S = BOT_SKILL[o.skill] || BOT_SKILL.normal, mid = World.mid, R = Math.min(World.size * 0.36, 150), mine = Units.def(G.cls), tier = mine.tier || 2;
    G.size = size; G.skill = S; G.skillId = BOT_SKILL[o.skill] ? o.skill : 'normal'; G.score2 = [0, 0]; G.ticket0 = 150 + size * 10; G.tickets = [G.ticket0, G.ticket0]; G.need = size * 3; G.matchT = 540;
    // the two bases: opposite ends of the line through the middle with the most open ground at both ends
    let best = 0, bs = -1; for (let a = 0; a < Math.PI; a += Math.PI / 8) { let s = 0; for (const sg of [-1, 1]) for (let d = R * 0.6; d <= R; d += 6) if (Game.clear(mid[0] + Math.sin(a) * d * sg, mid[1] + Math.cos(a) * d * sg, 6)) s++; if (s > bs) { bs = s; best = a; } }
    const ax = Math.sin(best), az = Math.cos(best); G.axis = [ax, az]; G.base = [Game.spot(mid[0] - ax * R, mid[1] - az * R, 6), Game.spot(mid[0] + ax * R, mid[1] + az * R, 6)];
    if (G.mode === 'conq') { const off = World.size * 0.14; G.points = [[-0.5, 1], [0, -1], [0.5, 1]].map((p, i) => { const s = Game.spot(mid[0] + ax * R * p[0] + az * off * p[1], mid[1] + az * R * p[0] - ax * off * p[1], 6); return { x: s[0], z: s[1], y: World.height(s[0], s[1]), v: 0, own: -1, name: 'ABC'[i], beam: Beams.add(s[0], s[1]) }; }); }
    // who is in it: you, and crews in vehicles of about your tier
    const names = CALLSIGNS.slice().sort(() => Math.random() - 0.5), pick = () => { const b = ['lt', 'mt', 'mt', 'ht', 'td', 'spaa'][(Math.random() * 6) | 0]; return b + clamp(tier + ((Math.random() * 3) | 0) - 1, 1, MAX_TIER); };
    G.roster = [{ name: 'You', team: 0, veh: G.cls, me: true, kills: 0, deaths: 0, score: 0, back: 0, U: null }];
    for (let t = 0; t < 2; t++) for (let i = t ? 0 : 1; i < size; i++) G.roster.push({ name: names.pop() || 'Crew', team: t, veh: pick(), kills: 0, deaths: 0, score: 0, back: 0, U: null });
    for (const r of G.roster) Game.deploy(r);
    HUD.banner(MODES[G.mode].name, G.mode === 'conq' ? 'take and hold A, B and C' : 'first side to ' + G.need + ' kills');
};
// put a crew on the field at its base, facing the fight
Game.deploy = function (r) {
    const G = Game, b = G.base[r.team], s = Game.spot(b[0] + rand(-14, 14), b[1] + rand(-14, 14), 5), yaw = Math.atan2(World.mid[0] - s[0], World.mid[1] - s[1]);
    const U = r.U = Units.make(r.team, s[0], s[1], yaw, r.veh, r.me ? G.mods : null); U.who = r; U.reload = 1; r.back = 0;
    if (r.me) { G.P = U; G.aimYaw = yaw; G.aimPitch = -0.04; G.kits = Math.max(G.kits, 1); } else Units.brain(U, clamp(G.skill.skill + rand(-0.12, 0.12), 0.05, 0.98));
    return U;
};
// who a computer-driven tank goes for: the nearest living enemy, looked at again every second or so
Game.targetFor = function (U) {
    const A = U.ai; if (A.tgt && !A.tgt.dead && A.tgtT > Game.time) return A.tgt; let best = null, bd = 1e9;
    for (const O of Units.list) { if (O.dead || O.team === U.team) continue; let d = Math.hypot(O.x - U.x, O.z - U.z); if (O === A.tgt) d *= 0.8; if (d < bd) { bd = d; best = O; } }
    A.tgt = best; A.tgtT = Game.time + rand(0.8, 1.6); return best;
};
// where it should be when nobody is close: a ring that is not its side's yet (each crew has its own favourite), else the middle
Game.goalFor = function (U) {
    const G = Game; if (G.mode !== 'conq') return World.mid; const open = G.points.filter(p => p.own !== U.team); const L = (open.length ? open : G.points).slice().sort((a, b) => Math.hypot(a.x - U.x, a.z - U.z) - Math.hypot(b.x - U.x, b.z - U.z));
    const p = L[Math.min(L.length - 1, U.id % 2)]; return [p.x, p.z];
};
Game.stepTeams = function (dt) {
    const G = Game; G.matchT -= dt;
    for (const r of G.roster) if (r.U && r.U.dead) { r.back -= dt; if (r.back <= 0 && !G.over) { const old = r.U; Game.deploy(r); if (r.me) { HUD.set('msg', ''); HUD.callout('BACK IN THE FIGHT'); Snd.ui('buy'); } if (old.deadT > 8) Units.retire(old); } }
    if (G.mode === 'conq') {
        let own = [0, 0];
        for (const p of G.points) { const n = [0, 0]; for (const U of Units.list) if (!U.dead && Math.hypot(U.x - p.x, U.z - p.z) < 16) n[U.team]++;
            if (n[0] !== n[1] && !(n[0] && n[1])) { const t = n[0] ? 0 : 1, was = p.own; p.v = clamp(p.v + (t ? 1 : -1) * dt * 0.09 * Math.min(3, n[t]), -1, 1); if (p.v <= -1) p.own = 0; else if (p.v >= 1) p.own = 1; else if ((p.own === 0 && p.v > 0) || (p.own === 1 && p.v < 0)) p.own = -1;
                if (p.own !== was && p.own >= 0) { HUD.banner(p.name + ' TAKEN', p.own === 0 ? 'by your side' : 'by the enemy'); Snd.tone(p.own ? 180 : 520, 0.25, 0.6, 'triangle', p.own ? 120 : 1040); for (const U of Units.list) if (!U.dead && U.team === p.own && U.who && Math.hypot(U.x - p.x, U.z - p.z) < 16) { U.who.score += 150; if (U.who.me) { G.caps++; G.score += 150; HUD.feed('<b>CAPTURED ' + p.name + '</b> +150'); } } } }
            if (p.own >= 0) own[p.own]++; p.beam.c = p.own === 0 ? [0.5, 1, 0.45] : p.own === 1 ? [1.3, 0.45, 0.3] : [1, 1, 1]; p.beam.k = 0.55 + Math.abs(p.v) * 0.45; }
        if (own[0] !== own[1]) { const loser = own[0] > own[1] ? 1 : 0, d = Math.abs(own[0] - own[1]); G.tickets[loser] = Math.max(0, G.tickets[loser] - dt * (d === 3 ? 2.6 : d === 2 ? 1.3 : 0.6)); }
        if (!G.over) { if (G.tickets[0] <= 0) Game.endTeams(1); else if (G.tickets[1] <= 0) Game.endTeams(0); else if (G.matchT <= 0) Game.endTeams(G.tickets[0] === G.tickets[1] ? -1 : G.tickets[0] > G.tickets[1] ? 0 : 1); }
    } else if (!G.over) { if (G.score2[0] >= G.need) Game.endTeams(0); else if (G.score2[1] >= G.need) Game.endTeams(1); else if (G.matchT <= 0) Game.endTeams(G.score2[0] === G.score2[1] ? -1 : G.score2[0] > G.score2[1] ? 0 : 1); }
};
// tank U was knocked out by tank `by` (team battles)
Game.knocked = function (U, by) {
    const G = Game, v = U.who, k = by && by.who; if (!v) return; v.deaths++; v.back = 6; if (k && by.team !== U.team) { k.kills++; k.score += 100; G.score2[by.team]++; }
    if (G.mode === 'conq') G.tickets[U.team] = Math.max(0, G.tickets[U.team] - 2);
    HUD.feed('<span class="t' + (k ? k.team : 1) + '">' + esc(k ? k.name : '?') + '</span> &#10005; <span class="t' + v.team + '">' + esc(v.name) + '</span>');
    if (v.me) { G.deaths++; HUD.banner('KNOCKED OUT', 'a new tank is on its way'); }
};
Game.endTeams = function (win) {
    const G = Game, me = G.roster[0], st = Save.data.stats; if (G.over) return; G.over = true; G.overT = 2.8; const won = win === 0;
    const pay = Game.pay(me.score * (won ? 1.5 : 1) + (won ? 300 : 80)); st.battles++; if (won) st.wins++; st.shots += G.shots; st.hits += G.hits; Save.store();
    G.result = { team: true, win, title: win < 0 ? 'A DRAW' : won ? 'VICTORY' : 'DEFEAT', sub: MODES[G.mode].name + ' &middot; ' + MAPS[World.id || UI.map].name, kills: me.kills, deaths: me.deaths, score: Math.round(me.score), acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, time: G.time, rp: pay.rp, cr: pay.cr, rows: G.roster.slice().sort((a, b) => b.score - a.score).map(r => ({ name: r.name, team: r.team, veh: Units.def(r.veh).name || '', kills: r.kills, deaths: r.deaths, score: Math.round(r.score), me: !!r.me })), line: G.mode === 'conq' ? Math.ceil(G.tickets[0]) + ' : ' + Math.ceil(G.tickets[1]) : G.score2[0] + ' : ' + G.score2[1] };
    HUD.banner(G.result.title, G.result.line); Snd.boom(0.8); Snd.tone(won ? 440 : 110, 0.3, 1.2, 'triangle', won ? 880 : 60); Music.set('menu');
};
// what a battle pays: research points and credits from the score, more in a higher tier and against better crews
Game.pay = function (score) { const G = Game, d = Units.def(G.cls), k = (1 + 0.25 * ((d.tier || 1) - 1)) * (G.skill ? G.skill.pay : 1), rp = Math.max(0, Math.round(score * 0.22 * k)), cr = Math.max(0, Math.round(score * 1.4 * k)); Save.data.rp += rp; Save.data.cr += cr; return { rp, cr }; };
Game.scoresHTML = function () { const G = Game, row = r => '<tr class="' + (r.me ? 'me' : '') + '"><td>' + esc(r.name) + '</td><td>' + esc(Units.def(r.veh).name || '') + '</td><td>' + r.kills + '</td><td>' + r.deaths + '</td><td>' + Math.round(r.score) + '</td></tr>';
    return [0, 1].map(t => '<table class="t' + t + '"><tr><th>' + SIDE[t] + '</th><th>vehicle</th><th>K</th><th>D</th><th>score</th></tr>' + G.roster.filter(r => r.team === t).sort((a, b) => b.score - a.score).map(row).join('') + '</table>').join(''); };

// ---- pillars of light over the rings of a conquest (one flat picture each, turned to the camera)
const Beams = { list: [], meshes: [], M: new Float32Array(16) };
Beams.add = function (x, z) {
    if (!Beams.meshes.length) { const tex = blobTexture(64, [[0, 'rgba(255,255,255,.9)'], [0.3, 'rgba(255,255,255,.3)'], [1, 'rgba(255,255,255,0)']], true); for (let i = 0; i < 4; i++) { const m = HG3D.mesh(quadGeo(), HG3D.material({ lit: false, map: tex, transparent: true, blending: 2, depthWrite: false, fog: false, side: 2 })); m.frustumCulled = false; m.renderOrder = 4; m.visible = false; World.scene.add(m); Beams.meshes.push(m); } }
    const b = { x, z, y: World.height(x, z), c: [1, 1, 1], k: 0.6 }; Beams.list.push(b); return b;
};
Beams.clear = function () { Beams.list.length = 0; for (const m of Beams.meshes) m.visible = false; };
Beams.draw = function (cw) { const e = Beams.M, l = Math.hypot(cw[0], cw[2]) || 1, rx = cw[0] / l, rz = cw[2] / l; for (let i = 0; i < Beams.meshes.length; i++) { const b = Beams.list[i], m = Beams.meshes[i]; m.visible = !!b; if (!b) continue; const w = 7, h = 70; e.fill(0); e[0] = rx * w; e[2] = rz * w; e[5] = h; e[8] = -rz; e[10] = rx; e[12] = b.x; e[13] = b.y + h / 2 - 2; e[14] = b.z; e[15] = 1; HG3D.place(m, e); m.material.color = { r: b.c[0] * b.k, g: b.c[1] * b.k, b: b.c[2] * b.k }; } };

// ---- the eye and the way it looks: behind and above the tank, or (sight) the gunner's sight over the gun
Game.eye = function () {
    const G = Game, P = G.P, cp = Math.cos(G.aimPitch), d = TV.d, e = TV.e, s = G.sight; d[0] = Math.sin(G.aimYaw) * cp; d[1] = Math.sin(G.aimPitch); d[2] = Math.cos(G.aimYaw) * cp;
    const back = TD.camDist * (1 - s) - 1.6 * s; e[0] = P.x - d[0] * back; e[2] = P.z - d[2] * back; e[1] = P.y + 4.2 * (1 - s) + 3.1 * s - d[1] * back * (1 - s);
    e[1] = Math.max(e[1], World.top(e[0], e[2]) + 1.2);
};
// the first ground, thing standing on it, or enemy tank along the line of sight (none: the sky)
Game.aim = function () {
    const G = Game, e = TV.e, d = TV.d, under = t => e[1] + d[1] * t < World.top(e[0] + d[0] * t, e[2] + d[2] * t); let t = TD.camDist * (1 - G.sight) + 4, pt = t, best = 1e9; G.aimAt = null;
    for (const U of Units.list) { if (U.team === 0 || U.dead) continue; const rx = U.x - e[0], ry = U.y + 1.4 - e[1], rz = U.z - e[2], along = rx * d[0] + ry * d[1] + rz * d[2]; if (along > t && along < best && rx * rx + ry * ry + rz * rz - along * along < 5.5) { best = along; G.aimAt = U; } }
    for (; t < 900 && t < best; pt = t, t += 1.5 + t * 0.03) if (under(t)) break;
    if (t >= best) t = best; else { G.aimAt = null; if (t >= 900) { G.aimHit = false; G.ax = e[0] + d[0] * 900; G.ay = e[1] + d[1] * 900; G.az = e[2] + d[2] * 900; return; } for (let i = 0; i < 6; i++) { const m = (pt + t) / 2; if (under(m)) t = m; else pt = m; } }
    G.aimHit = true; G.ax = e[0] + d[0] * t; G.ay = e[1] + d[1] * t; G.az = e[2] + d[2] * t;
};
// a sound out in the field, quieter with distance
Game.heard = function (x, z, vol, low, dur) { const P = Game.P, k = clamp(1.15 - Math.hypot(x - P.x, z - P.z) / 160, 0.06, 1); Snd.noise(vol * k, low * 6, low, dur); Snd.tone(low * 0.6, vol * k * 0.8, dur * 0.6, 'sine', low * 0.25); };
Game.landed = function () { };
// a shell struck tank U for dmg (0 = it glanced off); by = who fired
Game.struck = function (U, dmg, by, word) {
    const G = Game, P = G.P;
    if (G.teams) { if (by && by.who && dmg > 0 && by.team !== U.team) by.who.score += dmg / 8; if (U.dead && !U.counted) { U.counted = true; Game.knocked(U, by); } }
    if (U === P) { G.hurt = 1; G.shakeK = Math.max(G.shakeK, dmg > 0 ? 0.9 : 0.4); if (by && by !== P) HUD.from(by.x - P.x, by.z - P.z, G.aimYaw); HUD.callout(dmg > 0 ? word + '  -' + Math.round(dmg) : 'RICOCHET: ARMOUR HELD'); if (P.dead && !G.teams) { HUD.banner('TANK DESTROYED', 'wave ' + G.wave); Game.finish(); } return; }
    if (by !== P) return; if (word !== 'BLAST') G.hits++; G.dealt += dmg;
    if (U.dead) { G.kills++; const pts = G.teams ? 100 : 100 * G.wave; G.score += pts; HUD.hit(true); HUD.callout('DESTROYED  +' + pts); if (!G.teams) HUD.feed('<b>KILL</b> ' + word.toLowerCase() + ' <b>+' + pts + '</b>'); Snd.tone(440, 0.2, 0.5, 'triangle', 880); Save.data.stats.kills++; }
    else { HUD.hit(false); if (!(SHELLS[P.shellType].small && dmg > 0)) HUD.callout(dmg > 0 ? word + '  ' + Math.round(dmg) : 'RICOCHET'); Snd.tone(dmg > 0 ? 620 : 1400, 0.1, 0.08, 'square'); }
};
Game.nextWave = function () {
    const G = Game, P = G.P, w = ++G.wave, n = Math.min(5, 1 + Math.ceil(w / 1.5)), skill = clamp(0.12 + w * 0.09, 0, 0.9), base = Math.atan2(P.x - World.mid[0], P.z - World.mid[1]) + Math.PI, mine = Units.def(G.cls), tier = mine.tier || 0;
    for (let i = 0; i < n; i++) { let x = 0, z = 0; for (let tries = 0; tries < 30; tries++) { const a = base + rand(-1.3, 1.3), r = Math.min(150, World.size * 0.42) * rand(0.86, 1.05); x = World.mid[0] + Math.sin(a) * r; z = World.mid[1] + Math.cos(a) * r; if (World.inside(x, z) && Game.clear(x, z) && Math.hypot(x - P.x, z - P.z) > 45 && !Units.list.some(U => Math.hypot(U.x - x, U.z - z) < 9)) break; }
        const r = Math.random(); let kind = w >= 4 && r < 0.25 ? 'heavy' : w >= 2 && r < 0.6 ? 'light' : 'medium';
        if (tier) kind = (w >= 5 && r > 0.85 ? 'td' : kind === 'heavy' ? 'ht' : kind === 'light' ? 'lt' : 'mt') + clamp(tier + (w > 6 ? 1 : 0) - (w < 3 ? 1 : 0), 1, MAX_TIER);          // a tree vehicle meets the tree
        const U = Units.make(1, x, z, Math.atan2(World.mid[0] - x, World.mid[1] - z), kind); U.max = U.hp = U.max * (0.8 + 0.08 * w); Units.brain(U, skill); }
    G.phase = 'fight'; HUD.banner('WAVE ' + w, n + ' hostile tank' + (n > 1 ? 's' : '') + ' inbound'); Snd.boom(0.5); Snd.tone(90, 0.4, 1.2, 'sawtooth', 60);
};
Game.finish = function () {
    const G = Game, st = Save.data.stats; if (G.over) return; G.over = true; G.overT = 2.6; const pay = Game.pay(G.score * 0.5);
    G.result = { wave: G.wave, kills: G.kills, score: G.score, acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, time: G.time, record: G.score > st.bestScore && G.score > 0, rp: pay.rp, cr: pay.cr };
    st.bestWave = Math.max(st.bestWave, G.wave); st.bestScore = Math.max(st.bestScore, G.score); st.shots += G.shots; st.hits += G.hits; Save.store(); Music.set('menu');
};
Game.hud = function () {
    const G = Game, P = G.P, left = Game.enemies().length, me = G.roster[0], clock = t => Math.floor(Math.max(0, t) / 60) + ':' + String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0');
    HUD.set('hp', Math.max(0, P.hp / P.max * 100).toFixed(0) + '%', 'w'); HUD.set('hp-n', Math.max(0, Math.ceil(P.hp / P.max * 100))); HUD.set('hp-n', P.hp < P.max * 0.3 ? 'low' : '', 'c');
    HUD.set('wname', (P.def.full || P.def.name) + '   ' + P.shells.map((s, i) => '[' + (i + 1) + '] ' + SHELLS[s].name).join('  ')); HUD.set('ammo', SHELLS[P.shellType].name); HUD.set('reserve', P.k.auto ? '  ' + SHELLS[P.shellType].full : P.reload > 0 ? '  LOADING ' + P.reload.toFixed(1) : '  READY'); HUD.set('nades', 'REPAIR KITS ' + G.kits + (G.kits ? '  [R]' : ''));
    HUD.set('cash', String(Math.round(G.teams ? me.score : G.score)));
    const gun = '     RANGE ' + (G.aimHit ? Math.round(P.range) + ' m' : '---') + '     GUN ' + (P.elev >= 0 ? '+' : '') + (P.elev * 57.3).toFixed(1) + '°';
    HUD.set('score', G.teams ? '' : 'hidden', 'c');
    if (G.teams) { const conq = G.mode === 'conq', top = conq ? G.ticket0 : G.need, v = conq ? G.tickets : G.score2;
        for (let t = 0; t < 2; t++) { HUD.set('sc' + t, String(Math.ceil(v[t]))); HUD.set('sb' + t, clamp(v[t] / top * 100, 0, 100).toFixed(1) + '%', 'w'); }
        HUD.set('sclock', clock(G.matchT)); HUD.set('spts', conq ? G.points.map(p => '<em class="own' + p.own + '">' + p.name + '</em>').join('') : '<small>FIRST TO ' + G.need + '</small>', 'h');
        HUD.set('hud-top', gun.trim());
        // inside a ring: whose it is becoming
        const p = !P.dead && G.points.find(q => Math.hypot(q.x - P.x, q.z - P.z) < 16); HUD.set('cap', p ? '' : 'hidden', 'c'); if (p) { HUD.set('cap-t', p.own === 0 && p.v <= -1 ? 'HOLDING ' + p.name : p.v > 0 ? 'CONTESTED ' + p.name : 'TAKING ' + p.name); HUD.set('cap-b', (clamp(-p.v, 0, 1) * 100).toFixed(0) + '%', 'w'); } }
    else { HUD.set('cap', 'hidden', 'c'); HUD.set('hud-top', 'WAVE ' + G.wave + (G.phase === 'fight' ? '   \u00b7   ' + left + ' LEFT' : '') + gun); }
    HUD.set('prompt', G.over ? '' : G.teams ? (P.dead ? 'BACK IN ' + Math.ceil(Math.max(0, me.back)) : G.time < 14 ? 'W A S D drive   MOUSE aims the gun   CLICK or SPACE fires   E: gun sight   TAB: scores' : P.stop && P.k.arc ? 'TURN THE HULL: the gun is at the end of its arc' : '') : G.phase === 'break' && G.wave > 0 ? 'NEXT WAVE IN ' + Math.ceil(G.phaseT) + '   [ENTER]' : G.time < 14 ? 'W A S D drive   MOUSE aims the gun, up and down too   CLICK or SPACE fires   E: gun sight' : '');
};
Game.update = function (dt0) {
    const G = Game; let P = G.P, dt = dt0; G.frame++; G.time += dt;
    if (G.over) { G.overT -= dt0; if (G.overT <= 0 && !G.shown) { G.shown = true; UI.results(G.result); } }
    let thr = 0, steer = 0, fire = false;
    // the gunner's sight: E (press or hold, a setting), the right button or Shift
    const st = Save.data.settings; G.sight = lerp(G.sight, !P.dead && (Input.aim() || keys.ShiftLeft || keys.ShiftRight) ? 1 : 0, Math.min(1, dt * 9)); if (G.sight < 0.002) G.sight = 0;
    const sens = 0.0022 * st.sens * lerp(1, TD.sightFov / TD.fov * st.adsSens, G.sight);
    G.aimYaw -= mouse.dx * sens; G.aimPitch = clamp(G.aimPitch - mouse.dy * sens, -0.5, 0.55);
    if (!P.dead) {
        thr = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0); steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
        fire = (P.k.auto ? mouse.down || !!keys.Space : mouse.fired || !!hit.Space) && App.locked;
        if (hit.Digit1) { P.shellType = P.shells[0]; Snd.ui('click'); } if (hit.Digit2 && P.shells[1]) { P.shellType = P.shells[1]; Snd.ui('click'); }
        if (hit.KeyR && G.kits > 0 && P.hp < P.max) { G.kits--; P.hp = Math.min(P.max, P.hp + 450); HUD.callout('REPAIRED'); Snd.ui('buy'); }
        if (hit.Enter && G.phase === 'break' && G.wave > 0 && !G.teams) G.phaseT = Math.min(G.phaseT, 0.01);
        Units.drive(P, thr, steer, dt); Game.eye(); Game.aim(); Units.lay(P, G.ax, G.ay, G.az, G.aimHit, dt);
        Units.place(P); Units.fall(P, GF);
        if (fire && P.reload <= 0 && !G.over) { Units.fire(P, G); G.shots++; G.shakeK = Math.max(G.shakeK, P.k.auto ? 0.12 : 0.5); }
    }
    for (const U of Units.list.slice()) { if (U === G.P) continue; if (U.dead) { if (U.deadT > (G.teams ? 16 : 26)) Units.retire(U); } else if (U.ai) Units.ai(U, dt, G); }
    Units.step(dt, G);
    if (G.teams) Game.stepTeams(dt);
    else if (!G.over) {
        if (G.phase === 'break') { if (!G.shopOpen && !(G.upT > 0)) G.phaseT -= dt; if (G.phaseT <= 0) Game.nextWave(); }
        else if (!Game.enemies().length) { const pts = 250 * G.wave; G.phase = 'break'; G.phaseT = 9; G.score += pts; G.kits = Math.min(3, G.kits + 1); P.hp = Math.min(P.max, P.hp + P.max * 0.35); HUD.banner('WAVE ' + G.wave + ' CLEAR', '+' + pts + '    hull patched, one repair kit'); Snd.ui('buy'); G.upT = 1.6; }
    }
    if (G.upT > 0 && !G.over) { G.upT -= dt; if (G.upT <= 0) UI.upgrade(); }
    P = G.P; G.hurt = Math.max(0, G.hurt - dt * 1.4); G.shakeK = Math.max(0, G.shakeK - dt * 2.4);
    HUD.set('hurt', P.dead ? 0.8 : (G.hurt * 0.7 + (P.hp < P.max * 0.3 ? 0.22 : 0)).toFixed(2), 'o');
    Game.hud();
};
Game.render = function () {
    const G = Game, P = G.P, cam = World.camera, sh = Save.data.settings.shake ? G.shakeK * G.shakeK * 0.25 * (1 - G.sight * 0.7) : 0, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    const fov = lerp(Save.data.settings.fov, TD.sightFov, G.sight); if (cam.fov !== fov) { cam.fov = fov; cam.updateProjection(); }
    Game.eye(); const e = TV.e, d = TV.d; cam.lookFrom(e[0] + jx, e[1] + jy, e[2], e[0] + d[0] * 50, e[1] + d[1] * 50, e[2] + d[2] * 50);
    const w = cam.matrixWorld.elements, tf = Math.tan(fov * Math.PI / 360), toScreen = (x, y, z, out) => { const rx = x - w[12], ry = y - w[13], rz = z - w[14], vz = -(rx * w[8] + ry * w[9] + rz * w[10]); if (vz < 1) return false; out[0] = (0.5 + (rx * w[0] + ry * w[1] + rz * w[2]) / (vz * tf * cam.aspect) / 2) * innerWidth; out[1] = (0.5 - (rx * w[4] + ry * w[5] + rz * w[6]) / (vz * tf) / 2) * innerHeight; return true; };
    Units.render(w[12], w[13], w[14]); Beams.draw(w); World.step(1 / 60, w); draw(World.scene, cam, true); Minimap.draw(G, 1 / 60);
    // the gun ring: where the shell would land, on the screen
    const gm = $('gunmark'), s2 = Game.s2 || (Game.s2 = [0, 0]);
    if (P.dead || !toScreen(GF[0], GF[1], GF[2], s2)) gm.style.opacity = 0; else { gm.style.opacity = ''; gm.style.transform = 'translate(' + s2[0].toFixed(1) + 'px,' + s2[1].toFixed(1) + 'px)'; const cls = P.stop ? 'stop' : P.laid ? 'on' : ''; if (gm.className !== cls) gm.className = cls; }
    // a mark over every other tank (hostile: how far, what, how hurt; your side: its crew's name) and over every ring
    const box = $('marks'), E = Units.list.filter(U => U !== P && !U.dead), items = E.map(U => ({ x: U.x, y: U.y + 3.6, z: U.z, cls: U.team === 0 ? 'mark ally' : 'mark', t: U.team === 0 ? (U.who && Math.hypot(U.x - P.x, U.z - P.z) < 70 ? U.who.name : '') : Math.round(Math.hypot(U.x - P.x, U.z - P.z)) + (G.aimAt === U || !G.teams ? ' m' + (U.def.br ? '  ' + BR[U.def.br].one.toUpperCase() : U.kind !== 'medium' ? '  ' + U.def.name : '') + '  ' + Math.ceil(U.hp / U.max * 100) + '%' : '') }))
        .concat(G.points.map(p => ({ x: p.x, y: p.y + 9, z: p.z, cls: 'mark pt own' + p.own, t: p.name + (Math.abs(p.v) < 1 && p.v !== 0 ? ' ' + Math.round(Math.abs(p.v) * 100) + '%' : '') + '  ' + Math.round(Math.hypot(p.x - P.x, p.z - P.z)) + ' m' })));
    while (box.children.length < items.length) { const m = document.createElement('div'); m.innerHTML = '<b></b>'; box.appendChild(m); }
    for (let i = 0; i < box.children.length; i++) { const m = box.children[i], it = items[i]; if (!it || !toScreen(it.x, it.y, it.z, s2)) { m.style.display = 'none'; continue; } m.style.display = ''; if (m.className !== it.cls) m.className = it.cls; m.style.transform = 'translate(' + s2[0].toFixed(0) + 'px,' + s2[1].toFixed(0) + 'px) rotate(45deg)'; if (m.firstChild.textContent !== it.t) m.firstChild.textContent = it.t; }
    const sg = G.sight > 0.5 ? '1' : ''; if (($('hud').dataset.sight || '') !== sg) { if (sg) $('hud').dataset.sight = sg; else delete $('hud').dataset.sight; }
};
