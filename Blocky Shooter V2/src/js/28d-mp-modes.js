// ---------- 5.3 MORE PVP MODES: Free-for-all, Gun Game, Kill Confirmed, Capture the Flag, King of the Hill, Last Team Standing, Infection ----------
// The host is the referee for all of them, as for team deathmatch: it sees everyone's position (their snapshots), so it decides
// pick-ups, captures, hill time, rounds and infections, and sends the state out in one small 'mst' message whenever it changes
// (and once a second, which also catches up a player who joined late). Guests only draw it.
const MD = { on: false, mode: '', phase: '', until: 0, gg: {}, tags: [], flags: null, bases: null, hill: null, hills: [], hillIdx: 0, hillAt: 0, holder: -1,
             round: 0, rs: 0, sendT: 0, tickT: 0, tagSeq: 1, g: null, vis: null, alive: [0, 0] };
const GG_LIST = ['lmg', 'ar', 'burst', 'smg', 'shotgun', 'lever', 'dmr', 'sniper', 'revolver', 'pistol', 'katana'];
const INF_COLORS = [0x3b82f6, 0x84cc16];
const LTS_ROUND_S = 150, KC_TAG_S = 30, CTF_RETURN_S = 20, HILL_MOVE_S = 60, HILL_R = 5;
function isFfaMode(m) { m = m || NET.mode; return !!(MP_MODES[m] && MP_MODES[m].ffa); }
function modeTeamName(t) { return NET.mode === 'infect' ? (t & 1 ? 'INFECTED' : 'SURVIVORS') : TEAM_NAMES[t & 1]; }
function modeTeamCol(t) { return NET.mode === 'infect' ? INF_COLORS[t & 1] : TEAM_COLORS[t & 1]; }
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// ----- teams and loadouts -----
function modeDealTeams(mode) {          // host, just before the start message
    const all = allPlayers();
    if (isFfaMode(mode)) all.forEach((p, i) => { p.team = 2 + i; p.color = COOP_COLORS[i % COOP_COLORS.length]; });
    else if (mode === 'infect') {
        all.forEach(p => { p.team = 0; });
        const sh = all.slice().sort(() => Math.random() - 0.5);
        for (let i = 0; i < (all.length >= 8 ? 2 : 1); i++) sh[i].team = 1;
    }
    if (NET.me) NET.team = NET.me.team;
}
function modeLateTeam(p) {
    if (isFfaMode()) { let t = 2; for (const q of allPlayers()) if (q !== p) t = Math.max(t, q.team + 1); p.team = t; }
    else if (NET.mode === 'infect') p.team = 1;          // late to the party: you join the horde
}
function modeMaxHp(team) { return NET.mode === 'infect' && (team & 1) ? 150 : 100; }
function modeRespawnDelay(team) { return NET.mode === 'lts' ? 1e9 : NET.mode === 'infect' && (team === undefined ? NET.team : team) === 1 ? 2 : 3; }
function modeCanRespawn(p) { return NET.mode !== 'lts' && !NET.over; }
function modeHitOk(shooter, target) { return !(MD.on && MD.phase !== 'live'); }
function modeLoadout(fresh) {
    const m = NET.mode;
    maxHp = modeMaxHp(NET.team);
    let list, cur, sec = ['grenade'];
    if (m === 'gungame') { cur = GG_LIST[Math.min(GG_LIST.length - 1, MD.gg[NET.id] | 0)]; list = [cur]; sec = []; }
    else if (m === 'infect' && NET.team === 1) { list = ['katana']; cur = 'katana'; sec = []; }
    else if (m === 'infect') { list = ['pistol', 'smg', 'shotgun', 'ar']; cur = !fresh && list.includes(playerStats.currentWeapon) ? playerStats.currentWeapon : 'ar'; }
    else { list = WEAPON_ORDER.slice(); cur = !fresh && list.includes(playerStats.currentWeapon) ? playerStats.currentWeapon : 'ar'; }
    playerStats.weapons = list; playerStats.currentWeapon = cur;
    playerStats.secondaries = sec; playerStats.currentSecondary = sec[0] || null;
}
function modeBotWeapon(p) {
    const m = NET.mode;
    if (m === 'gungame') return GG_LIST[Math.min(GG_LIST.length - 1, MD.gg[p.id] | 0)];
    if (m === 'infect') return p.team === 1 ? 'katana' : ['ar', 'shotgun', 'smg'][p.id % 3];
    if (m === 'tourney') return 'ar';
    return (p.bot && p.bot.gun) || 'ar';
}
// where a bot should head for the objective (null = just hunt enemies)
function modeBotGoal(p) {
    const m = NET.mode, b = p.bot;
    if (!MD.on) return null;
    if (m === 'ctf' && MD.flags) {
        const t = p.team & 1, mine = MD.flags[t], theirs = MD.flags[1 - t];
        if (theirs.s === 'carried' && theirs.by === p.id) return MD.bases[t];                         // run it home
        if (mine.s === 'dropped' || (mine.s === 'carried' && p.id % 2 === 0)) return mine;              // return it / chase the thief
        if (p.id % 3 === 0 && mine.s === 'home') return MD.bases[t];                                    // a defender
        return theirs.s === 'carried' ? (b.tgt >= 0 ? null : MD.bases[t]) : theirs;                     // attack (or escort the carrier home)
    }
    if (m === 'koth' && MD.hill) { const a = p.id * 2.4; return { x: MD.hill.x + Math.cos(a) * 2, y: MD.hill.y, z: MD.hill.z + Math.sin(a) * 2 }; }
    if (m === 'kc' && MD.tags.length) {
        let best = null, bd = 30 * 30;
        for (const t of MD.tags) { const d = (t.x - b.x) ** 2 + (t.z - b.z) ** 2; if (d < bd) { bd = d; best = t; } }
        return best;
    }
    return null;
}
function modeIntro() {
    const M = MP_MODES[NET.mode];
    switch (NET.mode) {
        case 'ffa': return `FREE-FOR-ALL - first to ${M.target} kills`;
        case 'gungame': return 'GUN GAME - every kill gives you the next gun';
        case 'kc': return `KILL CONFIRMED - grab the tags, first to ${M.target}`;
        case 'ctf': return `CAPTURE THE FLAG - first to ${M.target} captures`;
        case 'koth': return `KING OF THE HILL - hold the hill, first to ${M.target}`;
        case 'lts': return `LAST TEAM STANDING - no respawns, first to ${M.target} rounds`;
        case 'infect': return NET.team === 1 ? 'INFECTION - you are INFECTED: get them all!' : 'INFECTION - survive for 3 minutes!';
    }
    return M.name;
}

// ----- start / stop -----
function modeReset() {
    MD.on = false; MD.mode = ''; MD.phase = ''; MD.gg = {}; MD.tags = []; MD.flags = null; MD.bases = null; MD.hill = null; MD.hills = []; MD.round = 0; MD.rs = 0; MD.holder = -1; MD.until = 0; MD.rsSeen = undefined; MD.myLv = undefined; MD.alive = [0, 0];
    if (MD.g) { scene.remove(MD.g); MD.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); MD.g = null; MD.vis = null; }
}
function modeBegin(cfg) {               // everyone, when the match starts (after the map is built)
    modeReset();
    MD.on = true; MD.mode = cfg.mode; MD.phase = 'live';
    const mins = MP_MODES[cfg.mode].mins; MD.until = mins ? performance.now() + mins * 60000 : 0;
    MD.g = new THREE.Group(); scene.add(MD.g); MD.vis = { flags: [], tags: new Map(), hill: null };
}
function modeHostStart(cfg) {           // host: set up the objectives
    const m = cfg.mode;
    if (m === 'ctf') {
        MD.bases = [0, 1].map(t => {
            const L = NET.spawns[t]; let cx = 0, cz = 0; for (const s of L) { cx += s[0]; cz += s[1]; } cx /= L.length; cz /= L.length;
            let best = L[0], bd = 1e9; for (const s of L) { const d = (s[0] - cx) ** 2 + (s[1] - cz) ** 2; if (d < bd) { bd = d; best = s; } }
            return { x: best[0], y: best[2] !== undefined ? best[2] : groundAt(best[0], best[1], 0.3, 0.5), z: best[1] };
        });
        MD.flags = [0, 1].map(t => ({ t, s: 'home', by: -1, x: MD.bases[t].x, y: MD.bases[t].y, z: MD.bases[t].z, dropT: 0 }));
    } else if (m === 'koth') {
        const A = ARENA * 0.38;
        MD.hills = [[0, 0], [A, 0], [-A, 0], [0, A], [0, -A], [A * 0.7, -A * 0.7], [-A * 0.7, A * 0.7]].map(([x, z]) => openSpotNear(x, z)).filter(Boolean);
        if (!MD.hills.length) MD.hills = [[spawnPt[0], 0, spawnPt[1]]];
        MD.hillIdx = 0; modeHillAt(0);
    } else if (m === 'lts') { MD.round = 0; ltsNextRound(); return; }
    modeSend();
}
function openSpotNear(x, z) {           // somewhere open to stand near (x, z): [x, y, z]
    if (VOID) { const s = nearestSafe(x, z); return s ? [s[0], s[1], s[2]] : null; }
    for (let r = 0; r <= 24; r += 2) for (let k = 0; k < (r ? 10 : 1); k++) {
        const a = k / 10 * Math.PI * 2, px = clamp(x + Math.cos(a) * r, -ARENA + 4, ARENA - 4), pz = clamp(z + Math.sin(a) * r, -ARENA + 4, ARENA - 4);
        const n = navNodeAt(px, pz, 0.2);
        if (n < 0 || nav.Y[n] > 0.1 || nav.ceil[n] < 5 || pointInSolid(new V3(px, 1, pz), 1.6)) continue;
        return [px, 0, pz];
    }
    return null;
}
function modeHillAt(i) { const h = MD.hills[i % MD.hills.length]; MD.hill = { x: h[0], y: h[1], z: h[2], r: HILL_R }; MD.hillAt = performance.now(); MD.holder = -1; }

// ----- the host's referee work -----
function modeEnd(win, wid, line) {
    if (NET.over) return;
    NET.over = true; MD.phase = 'over';
    const e = { t: 'end', win, score: NET.score, line };
    if (wid !== undefined) e.wid = wid;
    modeSend();
    setTimeout(() => { netBroadcast(e); netShowEnd(e); }, 1500);
}
function modeHostDeath(v, k, si) {
    const m = NET.mode, now = performance.now();
    if (m === 'ffa') {
        if (k) { k.pts = k.kills; if (k.kills >= NET.target) modeEnd(-1, k.id, `${k.name} WINS WITH ${k.kills} KILLS`); }
    } else if (m === 'gungame') {
        if (k) {
            const lv = (MD.gg[k.id] | 0) + 1;
            if (lv >= GG_LIST.length) { k.pts = lv; modeEnd(-1, k.id, `${k.name} WINS THE GUN GAME`); }
            else { MD.gg[k.id] = lv; k.pts = lv; }
            if (si === srcIdx('melee') && (MD.gg[v.id] | 0) > 0 && lv < GG_LIST.length) { MD.gg[v.id]--; v.pts = MD.gg[v.id]; modeSend(`${k.name} HUMILIATED ${v.name} (-1 gun)`, '#fca5a5'); return; }
        }
        modeSend();
    } else if (m === 'kc') {
        const P = netPosOf(v);
        if (P) { MD.tags.push({ id: MD.tagSeq++, x: P.x, y: P.y, z: P.z, team: v.team & 1, t: now }); if (MD.tags.length > 30) MD.tags.shift(); }
        modeSend();
    } else if (m === 'ctf') {
        for (const f of MD.flags || []) if (f.s === 'carried' && f.by === v.id) ctfDrop(f, netPosOf(v));
        modeSend();
    } else if (m === 'lts') ltsCheck();
    else if (m === 'infect') {
        if ((v.team & 1) === 0) {
            if (k && k.team === 1) k.pts = (k.pts | 0) + 1;
            modeSetTeam(v, 1);
            modeSend(`${v.name} ${k ? 'was infected by ' + k.name : 'turned'}`, '#bef264');
        } else if (k) k.pts = (k.pts | 0) + 1;
        infectCheck();
    }
}
function modeSetTeam(p, team) {
    p.team = team;
    const m = { t: 'tm', id: p.id, team };
    netBroadcast(m); modeTeamMsg(m);
}
function modeTeamMsg(m) {
    const q = playerById(m.id); if (!q) return;
    q.team = m.team;
    if (m.id === NET.id) { NET.team = m.team; if (NET.mode === 'infect' && m.team === 1) toast('YOU ARE INFECTED - get the survivors!', '#bef264', 2.4); }
    else if (q.av) rebuildAvatar(q);
}
function infectCheck() {
    if (NET.over) return;
    const all = allPlayers(), surv = all.filter(p => (p.team & 1) === 0), inf = all.filter(p => p.team === 1);
    if (!surv.length) { modeEnd(1, undefined, 'THE INFECTED GOT EVERYONE'); return; }
    if (!inf.length) { const p = surv[Math.floor(Math.random() * surv.length)]; modeSetTeam(p, 1); modeSend(`${p.name} IS THE NEW INFECTED`, '#bef264'); }
}
function ltsAlive() { const n = [0, 0]; for (const p of allPlayers()) if (p.alive && !p.spec && p.team <= 1) n[p.team]++; return n; }
function ltsCheck() {
    if (NET.over || MD.phase !== 'live') return;
    const n = ltsAlive(); MD.alive = n;
    if (n[0] && n[1]) return;
    ltsRoundWon(n[0] ? 0 : n[1] ? 1 : -1, n[0] || n[1] ? 'wiped out the other team' : 'both teams fell');
}
function ltsRoundWon(w, why) {
    if (w >= 0) NET.score[w]++;
    hostSendScore();
    if (w >= 0 && NET.score[w] >= NET.target) { modeEnd(w, undefined, `${TEAM_NAMES[w]} TEAM WINS ${NET.score[0]} - ${NET.score[1]}`); return; }
    MD.phase = 'break'; MD.until = performance.now() + 5000;
    modeSend(w >= 0 ? `ROUND ${MD.round}: ${TEAM_NAMES[w]} ${why}` : `ROUND ${MD.round}: DRAW (${why})`, w >= 0 ? hex(TEAM_COLORS[w]) : '#e5e7eb');
}
function ltsNextRound() {
    MD.round++; MD.rs++; MD.phase = 'live'; MD.until = performance.now() + LTS_ROUND_S * 1000;
    for (const p of netPlayers.values()) if (isBot(p)) botRespawn(p);
    modeSend(`ROUND ${MD.round} - FIGHT!`, '#fde047');
}
function ctfDrop(f, P) {
    f.s = 'dropped'; f.by = -1; f.dropT = performance.now();
    if (P) { f.x = P.x; f.z = P.z; f.y = VOID ? P.y : groundAt(P.x, P.z, 0.2, P.y + 0.3); }
}
const near2 = (P, x, y, z, r) => (P.x - x) ** 2 + (P.z - z) ** 2 < r * r && Math.abs(P.y - y) < 2.4;
function modeHostTick(dt) {
    const now = performance.now(), m = NET.mode;
    if (NET.over) return;
    // the clock
    if (MD.until && now > MD.until) {
        if (m === 'lts') {
            if (MD.phase === 'break') { ltsNextRound(); return; }
            const n = ltsAlive();
            if (n[0] !== n[1]) ltsRoundWon(n[0] > n[1] ? 0 : 1, 'had more players left');
            else ltsRoundWon(-1, 'time ran out');
            return;
        }
        if (m === 'infect') { const s = allPlayers().filter(p => (p.team & 1) === 0).length; modeEnd(0, undefined, `SURVIVORS WIN - ${s} MADE IT`); return; }
        if (isFfaMode()) { const lvl = (p) => m === 'gungame' ? MD.gg[p.id] | 0 : p.kills, w = allPlayers().sort((a, b) => lvl(b) - lvl(a) || b.kills - a.kills)[0]; modeEnd(-1, w.id, `TIME! ${w.name} WINS`); return; }
        const w = NET.score[0] === NET.score[1] ? -1 : NET.score[0] > NET.score[1] ? 0 : 1;
        modeEnd(w, undefined, w < 0 ? `TIME! A DRAW  ${NET.score[0]} - ${NET.score[1]}` : `TIME! ${TEAM_NAMES[w]} TEAM WINS  ${NET.score[0]} - ${NET.score[1]}`);
        return;
    }
    if ((MD.tickT -= dt) > 0) return;
    MD.tickT = 0.1;
    let changed = false, ev = '', evc = '';
    const live = allPlayers().filter(p => p.alive && !p.spec).map(p => [p, netPosOf(p)]).filter(x => x[1]);
    if (m === 'kc') {
        for (let i = MD.tags.length - 1; i >= 0; i--) {
            const t = MD.tags[i];
            if (now - t.t > KC_TAG_S * 1000) { MD.tags.splice(i, 1); changed = true; continue; }
            const who = live.find(([p, P]) => near2(P, t.x, t.y, t.z, 1.5));
            if (!who) continue;
            const p = who[0]; MD.tags.splice(i, 1); changed = true; p.pts = (p.pts | 0) + 1;
            if ((p.team & 1) !== t.team) { NET.score[p.team & 1]++; ev = `${p.name} confirmed a kill`; evc = hex(TEAM_COLORS[p.team & 1]); }
            else { ev = `${p.name} denied a kill`; evc = '#e5e7eb'; }
            hostSendScore();
            if (NET.score[p.team & 1] >= NET.target) { modeEnd(p.team & 1, undefined, `${TEAM_NAMES[p.team & 1]} TEAM WINS  ${NET.score[0]} - ${NET.score[1]}`); return; }
        }
    } else if (m === 'ctf' && MD.flags) {
        for (const f of MD.flags) {
            if (f.s === 'carried') {
                const c = playerById(f.by), P = c && c.alive ? netPosOf(c) : null;
                if (!P) { ctfDrop(f, c ? netPosOf(c) : null); changed = true; ev = `The ${TEAM_NAMES[f.t]} flag was dropped`; evc = '#e5e7eb'; continue; }
                f.x = P.x; f.y = P.y; f.z = P.z;
                const home = MD.bases[c.team & 1], mine = MD.flags[c.team & 1];
                if (mine.s === 'home' && near2(P, home.x, home.y, home.z, 2.6)) {
                    NET.score[c.team & 1]++; c.pts = (c.pts | 0) + 3;
                    f.s = 'home'; f.by = -1; f.x = MD.bases[f.t].x; f.y = MD.bases[f.t].y; f.z = MD.bases[f.t].z;
                    changed = true; ev = `${c.name} CAPTURED THE ${TEAM_NAMES[f.t]} FLAG!`; evc = hex(TEAM_COLORS[c.team & 1]);
                    hostSendScore();
                    if (NET.score[c.team & 1] >= NET.target) { modeSend(ev, evc); modeEnd(c.team & 1, undefined, `${TEAM_NAMES[c.team & 1]} TEAM WINS  ${NET.score[0]} - ${NET.score[1]}`); return; }
                }
                continue;
            }
            if (f.s === 'dropped' && now - f.dropT > CTF_RETURN_S * 1000) { f.s = 'home'; f.x = MD.bases[f.t].x; f.y = MD.bases[f.t].y; f.z = MD.bases[f.t].z; changed = true; ev = `The ${TEAM_NAMES[f.t]} flag went home`; evc = '#e5e7eb'; continue; }
            const who = live.find(([p, P]) => near2(P, f.x, f.y, f.z, 1.5) && (f.s === 'dropped' || (p.team & 1) !== f.t));
            if (!who) continue;
            const p = who[0];
            if ((p.team & 1) === f.t) { f.s = 'home'; f.x = MD.bases[f.t].x; f.y = MD.bases[f.t].y; f.z = MD.bases[f.t].z; p.pts = (p.pts | 0) + 1; ev = `${p.name} returned the ${TEAM_NAMES[f.t]} flag`; }
            else { f.s = 'carried'; f.by = p.id; ev = `${p.name} TOOK THE ${TEAM_NAMES[f.t]} FLAG`; }
            changed = true; evc = hex(TEAM_COLORS[p.team & 1]);
        }
    } else if (m === 'koth' && MD.hill) {
        if (now - MD.hillAt > HILL_MOVE_S * 1000) { MD.hillIdx++; modeHillAt(MD.hillIdx); changed = true; ev = 'THE HILL MOVED'; evc = '#fde047'; }
        const H = MD.hill, inside = live.filter(([p, P]) => near2(P, H.x, H.y, H.z, H.r)), n = [0, 0];
        for (const [p] of inside) n[p.team & 1]++;
        const holder = n[0] && n[1] ? 2 : n[0] ? 0 : n[1] ? 1 : -1;
        if (holder !== MD.holder) { MD.holder = holder; changed = true; }
        MD.kAcc = (MD.kAcc || 0) + 0.1;
        if (MD.kAcc >= 1) {
            MD.kAcc = 0;
            if (holder === 0 || holder === 1) {
                NET.score[holder]++; for (const [p] of inside) p.pts = (p.pts | 0) + 1;
                hostSendScore();
                if (NET.score[holder] >= NET.target) { modeEnd(holder, undefined, `${TEAM_NAMES[holder]} TEAM WINS  ${NET.score[0]} - ${NET.score[1]}`); return; }
            }
        }
    } else if (m === 'lts' && MD.phase === 'live') {
        const n = ltsAlive(); if (n[0] !== MD.alive[0] || n[1] !== MD.alive[1]) { MD.alive = n; changed = true; ltsCheck(); }
    } else if (m === 'infect') infectCheck();
    if (changed || ev) modeSend(ev, evc);
    else if ((MD.sendT -= 0.1) <= 0) modeSend();
}
function modeSnapshot(ev, evc) {
    const m = { t: 'mst', ph: MD.phase, rem: MD.until ? Math.max(0, (MD.until - performance.now()) / 1000) : -1, round: MD.round, rs: MD.rs, alive: MD.alive };
    if (NET.mode === 'gungame') m.gg = MD.gg;
    if (MD.tags.length || NET.mode === 'kc') m.tags = MD.tags.map(t => [t.id, r2(t.x), r2(t.y), r2(t.z), t.team]);
    if (MD.flags) { m.flags = MD.flags.map(f => [f.s === 'home' ? 0 : f.s === 'carried' ? 1 : 2, f.by, r2(f.x), r2(f.y), r2(f.z)]); m.bases = MD.bases.map(b => [r2(b.x), r2(b.y), r2(b.z)]); }
    if (MD.hill) m.hill = [r2(MD.hill.x), r2(MD.hill.y), r2(MD.hill.z), MD.hill.r, MD.holder, Math.max(0, HILL_MOVE_S - (performance.now() - MD.hillAt) / 1000)];
    if (ev) { m.ev = String(ev).slice(0, 80); m.evc = evc || '#fff'; }
    return m;
}
function modeSend(ev, evc) {
    if (!NET.host || !MD.on) return;
    MD.sendT = 1;
    const m = modeSnapshot(ev, evc);
    netBroadcast(m); modeEffects(m);
}

// ----- everyone: take in the host's state -----
function modeApply(m) {
    if (!MD.on || NET.host) return;
    MD.phase = m.ph; MD.until = m.rem >= 0 ? performance.now() + m.rem * 1000 : 0; MD.round = m.round | 0; MD.alive = m.alive || [0, 0];
    if (m.gg) MD.gg = m.gg;
    if (m.tags) MD.tags = m.tags.map(([id, x, y, z, team]) => ({ id, x, y, z, team }));
    if (m.flags) { MD.flags = m.flags.map(([s, by, x, y, z], t) => ({ t, s: s === 0 ? 'home' : s === 1 ? 'carried' : 'dropped', by, x, y, z })); MD.bases = m.bases.map(([x, y, z]) => ({ x, y, z })); }
    if (m.hill) { MD.hill = { x: m.hill[0], y: m.hill[1], z: m.hill[2], r: m.hill[3] }; MD.holder = m.hill[4]; MD.hillAt = performance.now() - (HILL_MOVE_S - m.hill[5]) * 1000; }
    modeEffects(m);
}
function modeEffects(m) {
    // gun game: you moved up (or down) a gun
    if (NET.mode === 'gungame' && m.gg) {
        const lv = MD.gg[NET.id] | 0;
        if (MD.myLv !== undefined && lv !== MD.myLv && !NET.dead) {
            modeLoadout(); ammoState[playerStats.currentWeapon] = W(playerStats.currentWeapon).magSize; updateGunModel(); updateHUD();
            if (lv > MD.myLv) { toast(`NEXT GUN: ${W(playerStats.currentWeapon).name.toUpperCase()}${lv === GG_LIST.length - 1 ? ' - LAST ONE!' : ''}`, '#fde047', 1.6); sfx('level'); }
        }
        MD.myLv = lv;
    }
    // last team standing: a new round puts everyone back at their spawn with full health
    if (NET.mode === 'lts' && m.rs !== undefined && m.rs !== MD.rsSeen) {
        const sat = MD.rsSeen === undefined && NET.dead;          // joined mid-round: keep waiting
        MD.rsSeen = m.rs; MD.rs = m.rs; if (m.ph === 'live' && !sat) netPvpRespawn();
    }
    if (m.ev) { netFeed(`<span style="color:${escHtml(m.evc || '#fff')}">${escHtml(m.ev)}</span>`); toast(m.ev, m.evc || '#fff', 1.8); }
    modeVisuals();
}
function netSitOut() {          // Last Team Standing: joined mid-round, so wait for the next one
    NET.dead = true; currentHp = 0; NET.me.alive = false; NET.respawnT = 1e9;
    if (vmModel) vmModel.root.visible = false;
    ui.netDown.classList.remove('hidden');
}

// ----- the objects on the map: flags, the hill, dog tags (unlit, a handful of draw calls) -----
const _mdMats = {};
const mdMat = (col, op) => { const k = col + ':' + (op || 1); return _mdMats[k] || (_mdMats[k] = new THREE.MeshBasicMaterial(op ? { color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide } : { color: col })); };
function modeVisuals() {
    if (!MD.g) return;
    const V = MD.vis;
    if (MD.flags && !V.flags.length) {
        for (const t of [0, 1]) {
            const g = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), mdMat(0xe5e7eb)); pole.position.y = 1.3; g.add(pole);
            const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), mdMat(TEAM_COLORS[t])); cloth.position.set(0.47, 2.25, 0); g.add(cloth);
            const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3.2, 12, 1, true), mdMat(TEAM_COLORS[t], 0.18)); glow.position.y = 1.6; g.add(glow);
            MD.g.add(g);
            const base = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.6, 28), mdMat(TEAM_COLORS[t], 0.55)); base.rotation.x = -Math.PI / 2;
            base.position.set(MD.bases[t].x, MD.bases[t].y + 0.06, MD.bases[t].z); MD.g.add(base);
            V.flags.push(g);
        }
    }
    if (MD.hill) {
        if (!V.hill) {
            const g = new THREE.Group();
            const ring = new THREE.Mesh(new THREE.RingGeometry(HILL_R - 0.35, HILL_R, 40), mdMat(0xffffff, 0.85)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; g.add(ring);
            const disc = new THREE.Mesh(new THREE.CircleGeometry(HILL_R - 0.35, 40), mdMat(0xffffff, 0.14)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
            const wall = new THREE.Mesh(new THREE.CylinderGeometry(HILL_R, HILL_R, 3, 40, 1, true), mdMat(0xffffff, 0.12)); wall.position.y = 1.5; g.add(wall);
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 40, 8, 1, true), mdMat(0xffffff, 0.22)); beam.position.y = 20; g.add(beam);
            MD.g.add(g); V.hill = g;
        }
        V.hill.position.set(MD.hill.x, MD.hill.y, MD.hill.z);
        const col = MD.holder === 0 || MD.holder === 1 ? TEAM_COLORS[MD.holder] : MD.holder === 2 ? 0xfde047 : 0xffffff;
        V.hill.children.forEach((o, i) => { o.material = mdMat(col, [0.85, 0.14, 0.12, 0.22][i]); });
    }
    // dog tags: keep one little spinning tag per live tag
    const seen = new Set();
    for (const t of MD.tags) {
        seen.add(t.id);
        if (!V.tags.has(t.id)) { const o = new THREE.Mesh(_tagGeo || (_tagGeo = new THREE.BoxGeometry(0.32, 0.46, 0.06)), mdMat(t.team ? 0x93c5fd : 0xfca5a5)); o.position.set(t.x, t.y + 0.9, t.z); MD.g.add(o); V.tags.set(t.id, o); }
    }
    for (const [id, o] of V.tags) if (!seen.has(id)) { MD.g.remove(o); V.tags.delete(id); }
}
let _tagGeo = null;
const _fp = new V3();
function modeTick(dt) {           // per frame, everyone
    if (NET.host) modeHostTick(dt);
    if (!MD.g) return;
    const V = MD.vis, t = gameTime;
    if (MD.flags) MD.flags.forEach((f, i) => {
        const g = V.flags[i]; if (!g) return;
        if (f.s === 'carried') {
            const c = playerById(f.by);
            if (f.by === NET.id) { g.visible = false; return; }
            g.visible = true;
            if (c && c.av) { g.position.copy(c.av.g.position); g.position.y += 0.9; g.scale.setScalar(0.6); }
            else g.position.set(f.x, f.y, f.z);
        } else { g.visible = true; g.scale.setScalar(1); g.position.set(f.x, f.y, f.z); g.rotation.y = t * 0.8; }
    });
    for (const o of V.tags.values()) { o.rotation.y = t * 3; o.position.y += Math.sin(t * 3 + o.id) * 0.002; }
    if (V.hill) V.hill.children[3].material.opacity = 0.16 + 0.08 * Math.sin(t * 3);
}

// ----- HUD, scoreboard, end screen -----
function modeHud() {
    const m = NET.mode, rem = MD.until ? (MD.until - performance.now()) / 1000 : -1, me = NET.me;
    const clock = rem >= 0 && MD.phase !== 'over' ? `<span class="text-base text-gray-300">${mmss(rem)}</span>` : '';
    const prot = NET.protT > 0 ? ' <span class="text-sm text-cyan-300">SPAWN PROTECTED</span>' : '';
    const T = (t, s) => `<span style="color:${hex(modeTeamCol(t))}">${s}</span>`;
    let sc = '', lv = MP_MODES[m].name, line = '', col = '';
    if (isFfaMode()) {
        const all = allPlayers().sort((a, b) => (b.pts | 0) - (a.pts | 0) || b.kills - a.kills), lead = all[0];
        if (m === 'gungame') {
            const my = MD.gg[NET.id] | 0, lw = lead ? MD.gg[lead.id] | 0 : 0;
            sc = `<span>GUN ${my + 1}/${GG_LIST.length}</span>${clock}<span style="color:${hex(lead ? pcol(lead) : 0xffffff)}">${lead ? escHtml(lead.id === NET.id ? 'YOU' : lead.name) + ' ' + (lw + 1) : ''}</span>`;
            line = `${W(playerStats.currentWeapon).name}${my < GG_LIST.length - 1 ? ' - next: ' + W(GG_LIST[my + 1]).name : ' - LAST GUN!'}`;
        } else {
            sc = `<span>YOU ${me ? me.kills : 0}</span>${clock}<span class="text-base text-gray-300">first to ${NET.target}</span><span style="color:${hex(lead ? pcol(lead) : 0xffffff)}">${lead ? escHtml(lead.id === NET.id ? 'YOU' : lead.name) + ' ' + lead.kills : ''}</span>`;
            line = lead && lead.id === NET.id ? 'You are in the lead!' : `Leader: ${lead ? lead.name : '-'}`;
        }
        col = hex(NET.color || 0xffffff);
    } else if (m === 'infect') {
        const all = allPlayers(), s = all.filter(p => (p.team & 1) === 0).length;
        sc = `${T(0, 'SURVIVORS ' + s)}${clock}${T(1, (all.length - s) + ' INFECTED')}`;
        line = NET.team === 1 ? 'INFECTED - get them!' : 'SURVIVE!'; col = hex(modeTeamCol(NET.team));
    } else {
        sc = `${T(0, 'RED ' + NET.score[0])}<span class="text-base text-gray-300">first to ${NET.target}</span>${clock}${T(1, NET.score[1] + ' BLUE')}`;
        col = hex(TEAM_COLORS[NET.team & 1]);
        if (m === 'ctf' && MD.flags) {
            const theirs = MD.flags[1 - (NET.team & 1)], mine = MD.flags[NET.team & 1];
            line = theirs.s === 'carried' && theirs.by === NET.id ? (mine.s === 'home' ? 'YOU HAVE THE FLAG - RUN HOME!' : 'YOU HAVE THE FLAG - get yours back to score') : mine.s === 'carried' ? 'YOUR FLAG IS TAKEN!' : mine.s === 'dropped' ? 'Your flag is down - touch it to return it' : 'Grab the enemy flag';
        } else if (m === 'koth') line = `HILL: ${MD.holder === 0 ? 'RED' : MD.holder === 1 ? 'BLUE' : MD.holder === 2 ? 'CONTESTED' : 'nobody'} - moves in ${mmss(HILL_MOVE_S - (performance.now() - MD.hillAt) / 1000)}`;
        else if (m === 'kc') line = `${MD.tags.length} tag${MD.tags.length === 1 ? '' : 's'} on the ground`;
        else if (m === 'lts') line = MD.phase === 'break' ? 'Next round in ' + Math.max(0, Math.ceil(rem)) : `ROUND ${MD.round} - alive ${MD.alive[0]} v ${MD.alive[1]}`;
        else line = `Your team: ${TEAM_NAMES[NET.team & 1]}`;
    }
    ui.netScore.innerHTML = sc + prot;
    setText(ui.txtLevel, lv); setText(ui.txtEnemies, line); ui.txtEnemies.style.color = col;
}
function modeStatLine(p) {
    switch (NET.mode) {
        case 'gungame': return ` - GUN ${Math.min(GG_LIST.length, (MD.gg[p.id] | 0) + 1)}/${GG_LIST.length}`;
        case 'kc': return ` - ${p.pts | 0} TAGS`;
        case 'ctf': return ` - ${p.pts | 0} PTS`;
        case 'koth': return ` - ${p.pts | 0}s ON THE HILL`;
        case 'infect': return ` - ${p.team === 1 ? 'INFECTED' : 'SURVIVED'}`;
    }
    return '';
}
function modeBoardHtml() {
    const col = { ffa: 'KILLS', gungame: 'GUN', kc: 'TAGS', ctf: 'POINTS', koth: 'HILL', lts: 'KILLS', infect: 'POINTS' }[NET.mode] || 'SCORE';
    const val = (p) => NET.mode === 'gungame' ? (MD.gg[p.id] | 0) + 1 : NET.mode === 'ffa' || NET.mode === 'lts' ? p.kills : p.pts | 0;
    const head = `<tr class="text-xs text-gray-400 tracking-widest"><td class="pr-6">PLAYER</td><td class="pr-6">${col}</td><td class="pr-6">KILLS</td><td class="pr-6">DEATHS</td><td>PING</td></tr>`;
    const rows = (list) => list.sort((a, b) => val(b) - val(a) || b.kills - a.kills).map(p => `<tr class="${p.id === NET.id ? 'bg-white/10' : ''}"><td class="py-1 pr-6 font-black" style="color:${hex(pcol(p))}">${tagHtml(p)}${escHtml(p.name)}${p.id === 0 ? ' <span class="text-[10px] text-amber-300">HOST</span>' : ''}${p.bot ? ' <span class="text-[10px] text-gray-400">BOT</span>' : ''}${p.alive ? '' : ' <span class="text-[10px] text-red-300">DEAD</span>'}</td><td class="pr-6">${val(p)}</td><td class="pr-6">${p.kills}</td><td class="pr-6">${p.deaths}</td><td>${pingCell(p)}</td></tr>`).join('');
    const all = allPlayers();
    let h = `<div class="text-2xl font-black mb-3">${escHtml(MP_MODES[NET.mode].name)} <span class="text-sm text-gray-400">${MAPS[run.map] ? MAPS[run.map].name : ''}${MD.until ? ' - ' + mmss((MD.until - performance.now()) / 1000) : ''}</span></div>`;
    if (isFfaMode()) h += `<table class="w-full text-sm font-bold">${head}${rows(all)}</table>`;
    else h += [0, 1].map(t => `<div class="font-black mt-2" style="color:${hex(modeTeamCol(t))}">${modeTeamName(t)}${NET.mode === 'infect' ? '' : ' - ' + NET.score[t]}</div><table class="w-full text-sm font-bold">${head}${rows(all.filter(p => (p.team & 1) === t))}</table>`).join('');
    return h;
}

// ----- rejoining: the host keeps a dropped player's score for 5 minutes, by name -----
function netGhostSave(p) {
    if (!NET.ghosts) NET.ghosts = new Map();
    NET.ghosts.set(p.name, { t: performance.now(), mode: NET.mode, team: p.team, kills: p.kills, deaths: p.deaths, pts: p.pts | 0, gg: MD.gg[p.id] | 0 });
}
function netGhostLoad(p) {
    const g = NET.ghosts && NET.ghosts.get(p.name);
    if (!g || g.mode !== NET.mode || performance.now() - g.t > 300000) return false;
    NET.ghosts.delete(p.name);
    Object.assign(p, { team: g.team, kills: g.kills, deaths: g.deaths, pts: g.pts });
    if (NET.mode === 'gungame') { MD.gg[p.id] = g.gg; modeSend(); }
    netFeed(`<span class="text-green-300">${escHtml(p.name)} is back - score kept</span>`);
    return true;
}

// Last Team Standing: click to watch the next teammate
document.addEventListener('mousedown', () => { if (NET.inGame && NET.dead && NET.mode === 'lts') NET.specIdx = (NET.specIdx | 0) + 1; });

// test hooks (5.3)
Object.assign(window.__blocky, {
    modes: {
        MD, GG_LIST, state: () => ({ on: MD.on, mode: MD.mode, phase: MD.phase, gg: MD.gg, tags: MD.tags.length, flags: MD.flags && MD.flags.map(f => f.s + ':' + f.by), hill: MD.hill && [MD.hill.x, MD.hill.z, MD.holder], round: MD.round, score: NET.score.slice(), over: NET.over, team: NET.team, rem: MD.until ? Math.round((MD.until - performance.now()) / 1000) : -1 }),
        players: () => allPlayers().map(p => ({ id: p.id, name: p.name, team: p.team, alive: !!p.alive, kills: p.kills, deaths: p.deaths, pts: p.pts | 0, bot: !!p.bot, spec: !!p.spec, vis: p.av ? p.av.g.visible : null, hp: p.hp })),
        addBots: (n) => { let k = 0; for (let i = 0; i < n; i++) if (botAdd()) k++; hostLobbyUpdate(); return k; },
        setMode: (m) => { NET.lobby.mode = m; for (const p of allPlayers()) p.team = 0; for (const p of allPlayers()) autoTeam(p); hostLobbyUpdate(); },
        start: () => hostStartGame(), problem: () => startProblem(),
        endIn: (s) => { MD.until = performance.now() + s * 1000; },
        kill: (victim, by) => { const v = playerById(victim); if (!v) return false; if (victim === NET.id) { NET.lastBy = by; takeDamage(9999); } else if (isBot(v)) botDamaged(v, 9999, by, srcIdx('ar')); else hostOnDeath(victim, by, srcIdx('ar')); return true; },
        botState: (id) => { const p = netPlayers.get(id); return p && isBot(p) ? { x: p.bot.x, z: p.bot.z, feet: p.bot.feet, hp: p.bot.hp, w: p.bot.w, tgt: p.bot.tgt, alive: p.alive } : null; },
        tp: (x, z) => { camera.position.set(x, groundAt(x, z, 0.3, 50) + EYE_STAND, z); feetY = groundAt(x, z, 0.3, 50); },
        weapons: () => ({ list: playerStats.weapons.slice(), cur: playerStats.currentWeapon, maxHp, prot: NET.protT }),
        delay: () => [...netPlayers.values()].map(p => Math.round((NET.host ? p.peer : NET.hostPeer) ? netDelay(NET.host ? p.peer : NET.hostPeer, performance.now()) : -1)),
        ghost: () => NET.ghosts ? [...NET.ghosts.keys()] : [],
        // run the game n frames of `ms` each, right now (tests: the headless browser draws far too slowly to play in real time)
        step: (n, ms = 50) => { for (let i = 0; i < n; i++) frame((prevTime || performance.now()) + ms); prevTime = performance.now(); return gameTime; },
        noRender: () => { renderer.render = () => {}; },
        get camera() { return camera; },
        invite: () => hostCreateInvite(), accept: (key, reply) => { const i = NET.invites.find(x => x.key === key); if (i) hostAcceptReply(i, reply); return !!i; }, dropLink: () => { try { NET.hostPeer.pc.close(); } catch (e) {} }
    }
});
