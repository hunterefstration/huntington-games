// ============================================================
// More kinds of match, on top of the deathmatch of 70-net.js (the host still referees; bots still fill the places):
//   gg    GUN GAME          every kill swaps your gun for the next on the list; a kill with the last one (a blade) wins
//   koth  KING OF THE HILL  a side scores each second it stands in the ring alone; the ring moves every 45 seconds
//   kc    KILL CONFIRMED    a kill drops a tag: your side picks it up to score, theirs to deny it
//   ctf   CAPTURE THE FLAG  carry their flag to your base while yours is at home
//   inf   INFECTION         one starts infected with a blade; whoever they kill joins them; three minutes to survive
//   lts   LAST TEAM STANDING  no coming back inside a round; the side with someone left takes it; three rounds win
//   hunt  HUNTED            the first kill makes you the Hunted (triple health): only the Hunted scores, and whoever
//                           kills the Hunted becomes it
// The host keeps the match's state (points, the ring, tags, flags, who is hunted) and sends it with every snapshot
// (Modes.pack / Modes.take); each computer draws the marks and arms its own player.
// ============================================================
const GG_ORDER = ['lmg', 'carbine', 'burst', 'smg', 'autoshot', 'shotgun', 'lever', 'dmr', 'sniper', 'revolver', 'pistol', 'knife'];
MP_MODES.dm.pvp = MP_MODES.tdm.pvp = true; MP_MODES.tdm.teams = true;
Object.assign(MP_MODES, {
    gg:   { name: 'GUN GAME', pvp: true, max: 6, blurb: 'Every kill swaps your gun for the next on the list, from the machine gun down to the knife. A kill with the knife wins.' },
    koth: { name: 'KING OF THE HILL', pvp: true, teams: true, max: 6, blurb: 'Hold the ring: a side scores every second it stands in it alone. The ring moves. First side to 90.' },
    kc:   { name: 'KILL CONFIRMED', pvp: true, teams: true, max: 6, blurb: 'A kill drops a tag. Pick up the ones your side earns, and the ones on your own dead to deny them. First side to the kill goal.' },
    ctf:  { name: 'CAPTURE THE FLAG', pvp: true, teams: true, max: 6, blurb: 'Carry their flag back to yours. Yours has to be at home to score. Three captures win.' },
    inf:  { name: 'INFECTION', pvp: true, teams: true, max: 6, blurb: 'One of you starts infected, with a blade. Whoever they kill joins them. The survivors win if one is still standing after three minutes.' },
    lts:  { name: 'LAST TEAM STANDING', pvp: true, teams: true, max: 6, blurb: 'Nobody comes back until the round is over: wipe out the other side to take it. First side to three rounds.' },
    hunt: { name: 'HUNTED', pvp: true, max: 6, blurb: 'The first kill makes you the Hunted: triple health, and only the Hunted scores. Kill the Hunted to become it. First to 10.' }
});
const Modes = { BLUE: [0.4, 0.75, 1.4], RED: [1.5, 0.4, 0.3], WHITE: [1.1, 1.1, 1.1], GOLD: [1.5, 1.1, 0.3] };
Modes.spot = i => World.spots.length ? World.spots[Math.floor(i * World.spots.length / 12) % World.spots.length] : World.home;
Modes.side = function (t) { const m = Net.cfg.mode; return m === 'inf' ? (t ? 'THE INFECTED' : 'THE SURVIVORS') : (t ? 'RED' : 'BLUE'); };
Modes.goal = function () { const m = Net.cfg.mode; return m === 'koth' ? 90 : m === 'ctf' || m === 'lts' ? 3 : m === 'hunt' ? 10 : m === 'kc' ? Net.cfg.goal * 2 : 0; };
// which gun a player starts the match with
Modes.kit = function (r) { const m = Net.cfg.mode; return m === 'gg' ? (Net.cfg.gg || GG_ORDER)[0] : r.kit; };
Modes.byId = function (G, id) { return id === Net.me.id ? G.P : G.players[Net.idx[id]]; };
// the start of a match, on every computer
Modes.begin = function (G) {
    const m = Net.cfg.mode; G.pts = [0, 0]; G.hillI = 0; G.hillT = 45; G.tags = []; G.hunted = ''; G.infOn = false; G.tier = 0; G.marksM = {}; G.flags = null; G.secT = 1; G.botFlows = {}; G.round = 0; G.roundT = 0;
    if (m === 'inf') G.matchT = 185;
    if (m === 'ctf') { const a = Modes.spot(0), b = Modes.spot(6); G.flags = [{ home: a, x: a[0], z: a[1], st: 0, by: '', t: 0 }, { home: b, x: b[0], z: b[1], st: 0, by: '', t: 0 }]; }
    if (m === 'gg') Modes.arm((Net.cfg.gg || GG_ORDER)[0]);
    if (m !== 'dm' && m !== 'tdm') HUD.banner(MP_MODES[m].name, m === 'gg' ? 'a kill gives you the next gun' : m === 'koth' ? 'stand in the ring' : m === 'kc' ? 'pick up the tags' : m === 'ctf' ? 'bring their flag home' : m === 'inf' ? 'one of you is about to turn' : 'the first kill makes the Hunted');
};
// put a weapon in the local player's hands (gun game's next gun, the blade of the infected)
Modes.arm = function (id) { if (!Weapons.made(id)) id = Weapons.made('knife') ? 'knife' : 'pistol'; Gun.load(id).then(() => { const G = Game; if (!App.game || G.mode !== 'dm') return; const s = WEAPONS[id].slot === 2 ? 2 : 0, ids = [null, null, null]; ids[s] = id; Gun.reset(ids); G.slot = s; G.lastSlot = s; Gun.equip(id, G.P); Game.hud(true); }, () => { }); };
// a player's side changed (infection): the roster row r; everyone's picture of that player follows, and if it is us, our hands
Modes.teamChanged = function (r) {
    const G = Game, p = Modes.byId(G, r.id); if (p) p.team = r.team;
    if (r.id === Net.me.id && Net.cfg.mode === 'inf' && r.team === 1) { HUD.banner('YOU ARE INFECTED', 'hunt the survivors'); Snd.boom(0.7); Modes.arm(Weapons.made('machete') ? 'machete' : 'knife'); }
};
Modes.setHunted = function (G, id) {
    if (G.hunted === id) return; const was = G.hunted; G.hunted = id; const r = Net.roster.find(x => x.id === id);
    if (id === Net.me.id) { Game.stats(); G.P.hp = G.P.max; HUD.banner('YOU ARE THE HUNTED', 'every kill scores: stay alive'); Snd.boom(0.7); } else { if (was === Net.me.id) Game.stats(); if (r) HUD.banner(r.name.toUpperCase() + ' IS THE HUNTED', 'bring them down'); }
    const b = Modes.byId(G, id); if (b && b.bot && Net.host) b.hp = 300;
};
// ---- the host: a kill happened. a = the killer's roster row (null: none or themselves), v = the one killed. Returns the winner or ''.
Modes.kill = function (G, a, v) {
    const m = Net.cfg.mode, goal = Net.cfg.goal;
    if (m === 'tdm') return a && Net.teamKills()[a.team] >= goal * 2 ? 't' + a.team : '';
    if (m === 'dm' || m === 'gg') return a && a.kills >= goal ? a.id : '';
    if (m === 'kc') { if (a && v) { const p = Modes.byId(G, v.id); if (p) G.tags.push({ x: p.x, z: p.z, team: a.team, t: 30 }); } return ''; }
    if (m === 'hunt') { if (v && v.id === G.hunted) Modes.setHunted(G, a ? a.id : ''); else if (a && !G.hunted) Modes.setHunted(G, a.id); else if (a && a.id === G.hunted) { a.pts = (a.pts || 0) + 1; if (a.pts >= Modes.goal()) return a.id; } return ''; }
    if (m === 'inf') { if (a && v && a.team === 1 && v.team === 0) { v.team = 1; Modes.teamChanged(v); const txt = esc(v.name) + ' <b>has turned</b>'; Net.all({ t: 'feed', txt }); HUD.feed(txt); if (!Net.roster.some(r => r.team === 0 && !r.gone)) return 't1'; } return ''; }
    if (m === 'ctf' && v && G.flags) for (let t = 0; t < 2; t++) { const F = G.flags[t]; if (F.st === 1 && F.by === v.id) { F.st = 2; F.by = ''; F.t = 20; const txt = '<b>' + Modes.side(t) + ' flag dropped</b>'; Net.all({ t: 'feed', txt }); HUD.feed(txt); } }
    return '';
};
// ---- the host, every frame
Modes.hostStep = function (G, dt) {
    const m = Net.cfg.mode, PL = G.players, alive = PL.filter(p => !p.dead && !p.gone), say = txt => { Net.all({ t: 'feed', txt }); HUD.feed(txt); }, end = w => { if (!G.over) { Net.all({ t: 'end', win: w }); G.finishMatch(w); } };
    if (G.over) return; G.secT -= dt; const tick = G.secT <= 0; if (tick) G.secT += 1;
    if (m === 'koth') {
        G.hillT -= dt; if (G.hillT <= 0) { G.hillT = 45; G.hillI = (G.hillI + 1) % 4; say('<b>THE RING HAS MOVED</b>'); }
        if (tick) { const h = Modes.hill(G), n = [0, 0]; for (const p of alive) if (Math.hypot(p.x - h[0], p.z - h[1]) < 5.5) n[p.team]++; if (n[0] && !n[1]) G.pts[0]++; else if (n[1] && !n[0]) G.pts[1]++; for (let t = 0; t < 2; t++) if (G.pts[t] >= Modes.goal()) return end('t' + t); }
    } else if (m === 'kc') {
        for (let i = G.tags.length - 1; i >= 0; i--) { const g = G.tags[i]; g.t -= dt; let gone = g.t <= 0; for (const p of alive) if (Math.hypot(p.x - g.x, p.z - g.z) < 1.3) { gone = true; if (p.team === g.team) { G.pts[g.team]++; say('<b>' + esc(p.name) + '</b> confirmed a kill'); } else say('<b>' + esc(p.name) + '</b> denied a kill'); break; } if (gone) G.tags.splice(i, 1); }
        for (let t = 0; t < 2; t++) if (G.pts[t] >= Modes.goal()) return end('t' + t);
    } else if (m === 'ctf') {
        for (let t = 0; t < 2; t++) { const F = G.flags[t], O = G.flags[1 - t];
            if (F.st === 1) { const c = Modes.byId(G, F.by); if (!c || c.dead || c.gone) { F.st = 2; F.by = ''; F.t = 20; } else { F.x = c.x; F.z = c.z; if (O.st === 0 && Math.hypot(c.x - O.home[0], c.z - O.home[1]) < 2) { G.pts[c.team]++; F.st = 0; F.by = ''; F.x = F.home[0]; F.z = F.home[1]; say('<b>' + esc(c.name) + '</b> captured the ' + Modes.side(t).toLowerCase() + ' flag'); Snd.boom(0.5); if (G.pts[c.team] >= Modes.goal()) return end('t' + c.team); } } }
            else { if (F.st === 2) { F.t -= dt; if (F.t <= 0) { F.st = 0; F.x = F.home[0]; F.z = F.home[1]; say('<b>' + Modes.side(t) + ' flag</b> is back at its base'); } }
                for (const p of alive) { if (Math.hypot(p.x - F.x, p.z - F.z) > 1.4) continue; if (p.team !== t) { F.st = 1; F.by = p === G.P ? Net.me.id : p.id; say('<b>' + esc(p.name) + '</b> has the ' + Modes.side(t).toLowerCase() + ' flag'); break; } else if (F.st === 2) { F.st = 0; F.x = F.home[0]; F.z = F.home[1]; say('<b>' + esc(p.name) + '</b> returned the flag'); break; } } } }
    } else if (m === 'lts') {
        if (G.roundT > 0) { G.roundT -= dt; if (G.roundT <= 0) { G.round++; for (const p of PL) if (p.bot) { const s = Game.spawnSpot(); p.x = p.tx = s[0]; p.z = p.tz = s[1]; p.hp = 100; p.dead = false; p.safe = 2; p.tgt = -1; } if (G.P.dead) Game.respawn(); else G.P.hp = G.P.max; } }
        else { const up = [0, 0]; for (const p of PL) if (!p.dead && !p.gone && p.team >= 0) up[p.team]++; if (!up[0] || !up[1]) { if (up[0] || up[1]) { const w = up[0] ? 0 : 1; G.pts[w]++; say('<b>' + Modes.side(w) + ' takes the round</b>'); if (G.pts[w] >= Modes.goal()) return end('t' + w); } G.roundT = 3.5; } }
    } else if (m === 'inf') {
        if (!G.infOn && G.time > 5) { G.infOn = true; const L = Net.roster.filter(r => !r.gone), r = L[(Math.random() * L.length) | 0]; r.team = 1; Modes.teamChanged(r); say('<b>' + esc(r.name) + '</b> is infected'); Net.all({ t: 'score', r: Net.roster.map(x => [x.id, x.kills, x.deaths, x.team, x.pts || 0]) }); Net.scores(); }
    }
    // where bots that have no one in sight should head: a path to the thing the match is about, worked out again each second
    if (tick) { const goals = m === 'koth' ? { h: Modes.hill(G) } : m === 'ctf' ? { f0: [G.flags[0].x, G.flags[0].z], f1: [G.flags[1].x, G.flags[1].z], b0: G.flags[0].home, b1: G.flags[1].home } : null; if (goals) for (const k in goals) { const F = G.botFlows[k] || (G.botFlows[k] = World.newFlow()); World.flow(F, goals[k][0], goals[k][1]); } }
};
Modes.hill = function (G) { return G.hillI === 3 ? World.home : Modes.spot(G.hillI * 4); };
// the path a bot follows when it sees no one (null: toward whoever it hunts, as in a deathmatch)
Modes.botFlow = function (G, b) {
    const m = Net.cfg.mode, F = G.botFlows || {}; if (m === 'koth') return F.h || null;
    if (m === 'ctf' && G.flags) { const mine = G.flags[b.team], theirs = G.flags[1 - b.team]; if (theirs.st === 1 && theirs.by === b.id) return F['b' + b.team]; if (mine.st !== 0) return F['f' + b.team]; if ((b.id.charCodeAt(1) & 1) === 0 || theirs.st === 2) return F['f' + (1 - b.team)]; }
    return null;
};
// the infected have no gun: they must close and strike
Modes.melee = b => Net.cfg.mode === 'inf' && b.team === 1;
// ---- what the host sends with every snapshot, and what a guest does with it
Modes.pack = function (G) {
    const m = Net.cfg.mode, r = v => Math.round(v * 10) / 10;
    if (m === 'koth') return ['k', G.pts[0], G.pts[1], G.hillI]; if (m === 'kc') return ['c', G.pts[0], G.pts[1], G.tags.map(g => [r(g.x), r(g.z), g.team])];
    if (m === 'ctf') { const f = G.flags; return ['f', G.pts[0], G.pts[1], f[0].st, r(f[0].x), r(f[0].z), f[0].by, f[1].st, r(f[1].x), r(f[1].z), f[1].by]; }
    if (m === 'hunt') return ['h', G.hunted]; if (m === 'lts') return ['l', G.pts[0], G.pts[1], G.round]; return null;
};
Modes.take = function (G, x) {
    if (x[0] === 'k') { G.pts[0] = x[1]; G.pts[1] = x[2]; G.hillI = x[3]; } else if (x[0] === 'c') { G.pts[0] = x[1]; G.pts[1] = x[2]; G.tags = x[3].map(g => ({ x: g[0], z: g[1], team: g[2], t: 9 })); }
    else if (x[0] === 'f' && G.flags) { G.pts[0] = x[1]; G.pts[1] = x[2]; for (let t = 0; t < 2; t++) { const F = G.flags[t], o = 3 + t * 4; F.st = x[o]; F.x = x[o + 1]; F.z = x[o + 2]; F.by = x[o + 3]; } }
    else if (x[0] === 'h') Modes.setHunted(G, x[1]);
    else if (x[0] === 'l') { G.pts[0] = x[1]; G.pts[1] = x[2]; if (x[3] !== G.round) { G.round = x[3]; if (G.P.dead) Game.respawn(); else G.P.hp = G.P.max; } }
};
// ---- every computer, every frame: the marks on the ground, the tags lying about, gun game's next gun
Modes.step = function (G, dt) {
    const m = Net.cfg.mode, M = G.marksM, P = G.P, mark = (k, x, z, r, c, tall) => { let q = M[k]; if (!q) q = M[k] = Marks.add(x, z, r, c, tall); q.x = x; q.z = z; q.c = c; return q; }, mine = t => t === P.team;
    if (m === 'koth') { const h = Modes.hill(G); mark('hill', h[0], h[1], 5.5, Modes.GOLD, 18); }
    else if (m === 'ctf' && G.flags) for (let t = 0; t < 2; t++) { const F = G.flags[t], c = t ? Modes.RED : Modes.BLUE; mark('b' + t, F.home[0], F.home[1], 2, c, 0); mark('f' + t, F.x, F.z, 0, F.st === 2 ? Modes.WHITE : c, F.st === 1 ? 5 : 11); }
    else if (m === 'hunt') { const h = G.hunted && G.hunted !== Net.me.id ? Modes.byId(G, G.hunted) : null; if (h && !h.dead) mark('hunted', h.x, h.z, 0, Modes.RED, 9); else if (M.hunted) { Marks.remove(M.hunted); delete M.hunted; } }
    if (m === 'kc') { G.pickups.length = 0; for (const g of G.tags) G.pickups.push({ kind: 'tag', x: g.x, z: g.z, t: G.time % 20, mine: mine(g.team) }); }
    if (m === 'gg') { const me = Net.roster.find(r => r.id === Net.me.id), L = Net.cfg.gg || GG_ORDER, t = me ? Math.min(me.kills, L.length - 1) : 0; if (t !== G.tier) { G.tier = t; Modes.arm(L[t]); HUD.banner(WEAPONS[L[t]].name, t === L.length - 1 ? 'the last one: a kill with this wins' : 'gun ' + (t + 1) + ' of ' + L.length); } }
};
// the line along the top (empty: the deathmatch's own)
Modes.line = function (G) {
    const m = Net.cfg.mode, P = G.P, t = Math.max(0, G.matchT), clock = '     ' + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'), side = (P.team ? 'RED ' : 'BLUE ') + G.pts[P.team === 1 ? 1 : 0] + '     ' + (P.team ? 'BLUE ' : 'RED ') + G.pts[P.team === 1 ? 0 : 1] + '     FIRST TO ' + Modes.goal();
    if (m === 'koth' || m === 'kc') return side + clock;
    if (m === 'lts') return side + '     ROUND ' + (G.round + 1) + clock;
    if (m === 'ctf') { const F = G.flags, st = f => f.st === 0 ? 'home' : f.st === 1 ? 'TAKEN' : 'dropped'; return side + '     your flag: ' + st(F[P.team === 1 ? 1 : 0]) + clock; }
    if (m === 'gg') { const L = Net.cfg.gg || GG_ORDER; return 'GUN ' + (G.tier + 1) + ' / ' + L.length + (G.lead ? '     LEADER ' + G.lead.name.toUpperCase() + ' ' + (G.lead.kills + 1) : '') + clock; }
    if (m === 'inf') { const s = Net.roster.filter(r => r.team === 0 && !r.gone).length; return (P.team === 1 ? 'YOU ARE INFECTED' : 'SURVIVE') + '     ' + s + ' SURVIVOR' + (s === 1 ? '' : 'S') + ' LEFT' + clock; }
    if (m === 'hunt') { const me = Net.roster.find(r => r.id === Net.me.id), h = Net.roster.find(r => r.id === G.hunted); return (G.hunted === Net.me.id ? 'YOU ARE THE HUNTED' : h ? 'HUNTED: ' + h.name.toUpperCase() : 'NO ONE IS HUNTED YET') + '     YOUR SCORE ' + ((me && me.pts) || 0) + ' / ' + Modes.goal() + clock; }
    return '';
};
// who is ahead when the clock runs out
Modes.leader = function () {
    const m = Net.cfg.mode, G = Game; if (m === 'inf') return 't0'; if (m === 'koth' || m === 'kc' || m === 'ctf' || m === 'lts') return G.pts[1] > G.pts[0] ? 't1' : 't0';
    if (m === 'hunt') return Net.roster.slice().sort((a, b) => (b.pts || 0) - (a.pts || 0) || b.kills - a.kills)[0].id; return '';
};
