// ============================================================
// Multiplayer, peer to peer the way Blocky Shooter does it: the host's browser is the referee, players find each other
// with a 6-digit code through PeerJS's free matchmaking server, and after that the browsers talk directly (WebRTC).
// Two pipes per link: "rel" never loses a message (events), "fast" is fire-and-forget (positions, 15 times a second).
//   SQUAD HOLDOUT  the host runs the ashen and the waves; guests draw them from snapshots and report their hits
//   DEATHMATCH     everyone against everyone (bots fill the empty places); the shooter decides a hit, the one hit
//                  owns their own health, the host keeps the score
// ============================================================
const NET_V = 1, PJ_PREFIX = 'ashfall-v1-', MP_MAX = 6;
const MP_MODES = { coop: { name: 'SQUAD HOLDOUT', blurb: 'The waves, together. Up to four. Anyone down is back when the wave is cleared.', max: 4 }, dm: { name: 'DEATHMATCH', blurb: 'Everyone for themselves. First to the kill goal wins. Bots fill the empty places.', max: 6 },
    tdm: { name: 'TEAM DEATHMATCH', blurb: 'Two sides, blue and red, bots evening them out. The first side to twice the kill goal wins. No friendly fire.', max: 6 } };
const BOT_NAMES = ['Cinder', 'Vex', 'Ashby', 'Rook', 'Mara', 'Dutch', 'Wren', 'Holt', 'Sable', 'Kite'];
const Net = { on: false, host: false, state: 'idle', code: '', err: '', pj: null, peers: {}, me: { id: 'H', name: '' }, roster: [], cfg: { mode: 'coop', map: 'yard', diff: 'normal', goal: 15, bots: 3 }, sendT: 0, snapT: 0, hits: [], idx: {}, avatars: null, tags: {}, botT: 0 };

Net.loadPeer = function () {
    if (window.Peer) return Promise.resolve(window.Peer); if (Net.pjLoading) return Net.pjLoading;
    return Net.pjLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = () => window.Peer ? res(window.Peer) : rej(new Error('The matchmaking helper did not load.')); s.onerror = () => { Net.pjLoading = null; rej(new Error('Could not reach the matchmaking service. Are you online?')); }; document.head.appendChild(s); });
};
// our two pipes on one PeerJS connection: its own reliable channel, and a fast one we open beside it
Net.wire = function (conn, id) {
    const pc = conn.peerConnection, rel = conn.dataChannel, fast = pc.createDataChannel('u', { negotiated: true, id: 50, ordered: false, maxRetransmits: 0 });
    const peer = { id, conn, rel, fast, last: performance.now() };
    const on = e => { peer.last = performance.now(); let m; try { m = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data)); } catch (x) { return; } if (m && m.t) (Net.host ? Net.hostMsg : Net.guestMsg)(m, peer); };
    rel.addEventListener('message', on); fast.addEventListener('message', on);
    const gone = () => { if (peer.dead) return; peer.dead = true; if (Net.host) Net.hostLost(peer); else Net.hostGone(); };
    conn.on('close', gone); conn.on('error', gone); pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') gone(); });
    return peer;
};
Net.send = function (peer, m, fast) { try { const ch = fast && peer.fast.readyState === 'open' ? peer.fast : peer.rel; if (ch.readyState === 'open') ch.send(JSON.stringify(m)); } catch (e) { } };
Net.all = function (m, fast, but) { for (const id in Net.peers) if (id !== but) Net.send(Net.peers[id], m, fast); };
Net.name = () => (Save.data.name || '').trim().slice(0, 14) || 'Drifter';
Net.entry = (id, name, bot) => ({ id, name, bot: !!bot, cls: 'assault', kit: 'carbine', kills: 0, deaths: 0, team: -1 });
Net.teamOf = id => { const r = Net.roster.find(x => x.id === id); return r ? r.team : -1; };
Net.teamKills = () => [0, 1].map(t => Net.roster.reduce((s, r) => s + (r.team === t ? r.kills : 0), 0));
// who is ahead when the clock runs out (a player's id, or 't0' / 't1' for a side)
Net.leader = function () { const ml = Modes.leader(); if (ml) return ml; if (Net.cfg.mode === 'tdm') { const k = Net.teamKills(); return k[1] > k[0] ? 't1' : 't0'; } return Net.roster.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0].id; };
Net.lobby = function () { if (Net.host) Net.all({ t: 'lobby', cfg: Net.cfg, roster: Net.roster }); if (UI.panel === 'mp') UI.draw(); };

// ---- making and joining a party
Net.hostGame = async function (tries) {
    Net.reset(); Net.on = true; Net.host = true; Net.state = 'opening'; Net.me = { id: 'H', name: Net.name() }; Net.roster = [Net.entry('H', Net.me.name)]; Net.roster[0].cls = UI.setup.cls; UI.draw();
    try {
        const Peer = await Net.loadPeer(); if (!Net.host || Net.state !== 'opening') return;
        const code = String(100000 + Math.floor(Math.random() * 900000)), pj = Net.pj = new Peer(PJ_PREFIX + code, { debug: 0 });
        pj.on('open', () => { if (Net.pj !== pj) return; Net.code = code; Net.state = 'lobby'; UI.draw(); });
        pj.on('error', e => { if (Net.pj !== pj) return; if (e.type === 'unavailable-id' && (tries || 0) < 6) { pj.destroy(); Net.hostGame((tries || 0) + 1); return; } if (Net.state === 'opening') { Net.fail('Could not open a party (' + e.type + ').'); } });
        pj.on('disconnected', () => { if (Net.pj === pj && !pj.destroyed) setTimeout(() => { try { pj.reconnect(); } catch (e) { } }, 1500); });
        pj.on('connection', conn => conn.on('open', () => { if (conn.label !== 'ashfall') { conn.close(); return; } const peer = Net.wire(conn, ''); peer.pending = true; setTimeout(() => { if (peer.pending) try { conn.close(); } catch (e) { } }, 8000); }));
    } catch (e) { Net.fail(e.message); }
};
Net.join = async function (raw, attempt) {
    const code = String(raw || '').replace(/\D/g, ''); if (code.length !== 6) { Net.err = 'Party codes are 6 digits.'; UI.draw(); return; }
    Net.reset(); Net.on = true; Net.host = false; Net.state = 'joining'; Net.code = code; Net.me = { id: '', name: Net.name() }; UI.draw();
    try {
        const Peer = await Net.loadPeer(); if (Net.state !== 'joining') return; const pj = Net.pj = new Peer({ debug: 0 }); let done = false;
        const fail = (msg, retry) => { if (done || Net.pj !== pj) return; done = true; clearTimeout(timer); try { pj.destroy(); } catch (e) { } if (retry && (attempt || 0) < 2) { setTimeout(() => Net.join(code, (attempt || 0) + 1), 1200); return; } Net.fail(msg); };
        const timer = setTimeout(() => fail('Could not connect in time. Check the code; a school network may be blocking it.', true), 15000);
        pj.on('error', e => fail(e.type === 'peer-unavailable' ? 'No party has the code ' + code + '.' : 'Connection problem (' + e.type + ').', e.type !== 'peer-unavailable'));
        pj.on('open', () => { const conn = pj.connect(PJ_PREFIX + code, { label: 'ashfall', serialization: 'raw', reliable: true });
            conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); const peer = Net.wire(conn, 'H'); Net.peers = { H: peer }; Net.send(peer, { t: 'hi', name: Net.me.name, v: NET_V, cls: UI.setup.cls, kit: UI.setup.kit || 'carbine' }); setTimeout(() => { try { pj.disconnect(); } catch (e) { } }, 1500); }); });
    } catch (e) { Net.fail(e.message); }
};
Net.solo = function () { Net.reset(); Net.on = true; Net.host = true; Net.state = 'lobby'; Net.me = { id: 'H', name: Net.name() }; Net.roster = [Net.entry('H', Net.me.name)]; Net.roster[0].cls = UI.setup.cls; Net.roster[0].kit = UI.setup.kit || 'carbine'; if (Net.cfg.mode === 'coop') Net.cfg.mode = 'dm'; if (!Net.cfg.bots) Net.cfg.bots = 3; UI.draw(); };
Net.fail = function (msg) { Net.reset(); Net.err = msg; if (UI.panel === 'mp') UI.draw(); };
Net.dropAvatars = function () { if (Net.avatars && Net.avatars.fromMap) { World.scene.remove(Net.avatars.node); R.release(Net.avatars.node); Net.avatars = null; } };
Net.reset = function () {
    for (const id in Net.peers) try { Net.peers[id].conn.close(); } catch (e) { } if (Net.pj) try { Net.pj.destroy(); } catch (e) { }
    Ticker.stop(); Net.pj = null; Net.peers = {}; Net.on = false; Net.host = false; Net.state = 'idle'; Net.code = ''; Net.err = ''; Net.roster = []; Net.hits = []; for (const k in Net.tags) { Net.tags[k].remove(); } Net.tags = {};
};
Net.leave = function () { if (!Net.on) return; if (Net.host) Net.all({ t: 'bye' }); else if (Net.peers.H) Net.send(Net.peers.H, { t: 'bye' }); setTimeout(() => Net.reset(), 60); Game.net = null; };
Net.hostGone = function () { if (!Net.on || Net.host) return; const inGame = App.game && Game.net; Net.reset(); Net.err = 'The host left the party.'; if (inGame) { Game.net = null; Game.stop(); UI.menu(); } UI.open('mp'); };
Net.hostLost = function (peer) {
    if (!peer.id) return; delete Net.peers[peer.id]; const i = Net.roster.findIndex(r => r.id === peer.id); if (i < 0) return; const name = Net.roster[i].name;
    if (Net.state === 'game') { const p = Game.players[Net.idx[peer.id]]; if (p) { p.gone = true; p.dead = true; } Net.all({ t: 'left', id: peer.id }); HUD.feed(esc(name) + ' left'); Net.roster[i].gone = true; Net.checkOver(); } else { Net.roster.splice(i, 1); Net.lobby(); }
};

// ---- the host hears a guest
Net.hostMsg = function (m, peer) {
    const G = Game;
    if (m.t === 'hi') {
        if (m.v !== NET_V) { Net.send(peer, { t: 'no', why: 'This party runs another version of Ashfall. Reload the game.' }); return; }
        if (Net.state !== 'lobby' || Net.roster.filter(r => !r.bot).length >= MP_MODES[Net.cfg.mode].max) { Net.send(peer, { t: 'no', why: Net.state !== 'lobby' ? 'That party is in a match. Try again when it ends.' : 'That party is full.' }); return; }
        let n = 1; while (Net.peers['p' + n]) n++; peer.id = 'p' + n; peer.pending = false; Net.peers[peer.id] = peer; const e = Net.entry(peer.id, String(m.name || 'Drifter').slice(0, 14)); e.cls = CLASSES[m.cls] ? m.cls : 'assault'; e.kit = WEAPONS[m.kit] ? m.kit : 'carbine'; Net.roster.push(e);
        Net.send(peer, { t: 'you', id: peer.id }); Net.lobby(); Snd.ui('buy'); return;
    }
    if (!peer.id) return; const k = Net.idx[peer.id], p = Net.state === 'game' ? G.players[k] : null, r = Net.roster.find(x => x.id === peer.id);
    if (m.t === 'kit') { if (r) { if (CLASSES[m.cls]) r.cls = m.cls; if (WEAPONS[m.kit]) r.kit = m.kit; Net.lobby(); } }
    else if (m.t === 'S') { if (p) Net.take(p, m.s); }
    else if (m.t === 'h') { if (p && G.mode !== 'dm') for (const h of m.l) { const e = Foes.list.find(x => x.id === h[0]); if (e) Foes.damage(e, Math.min(2000, +h[1] || 0), !!h[2], G, k); } }
    else if (m.t === 'ph') Net.pvpHit(peer.id, m.to, Math.min(600, +m.dmg || 0), !!m.head, m.w);
    else if (m.t === 'dead') { if (p) { p.dead = true; if (G.mode === 'dm') Net.scoreKill(m.by, peer.id, m.head, m.w); else { Net.all({ t: 'feed', txt: esc(r.name) + ' is down' }); HUD.feed(esc(r.name) + ' is down'); Net.checkOver(); } } }
    else if (m.t === 'heal') { Net.all(m, false, peer.id); Net.healNear(m.x, m.z); }
    else if (m.t === 'bye') Net.hostLost(peer);
};
// ---- a guest hears the host
Net.guestMsg = function (m) {
    const G = Game, P = G.P;
    if (m.t === 'you') { Net.me.id = m.id; Net.state = 'lobby'; UI.draw(); }
    else if (m.t === 'no') Net.fail(m.why);
    else if (m.t === 'lobby') { Net.cfg = m.cfg; Net.roster = m.roster; if (Net.state !== 'game') { Net.state = 'lobby'; if (UI.panel === 'mp') UI.draw(); } }
    else if (m.t === 'start') { Net.cfg = m.cfg; Net.roster = m.roster; Net.begin(); }
    else if (m.t === 'bye') Net.hostGone();
    else if (Net.state !== 'game' || App.game !== G) return;
    else if (m.t === 'P') Net.snapshot(m);
    else if (m.t === 'd') G.hurt(0, m.dmg, m.fx, m.fz, null);
    else if (m.t === 'pd') Net.takeHit(m);
    else if (m.t === 'k') { const e = Foes.list.find(x => x.id === m.id); if (e && e.state !== 'die') { e.state = 'die'; e.t = 0; e.hp = 0; if (e.T.blast) World.boom(e.x, 0.8, e.z, true); G.killed(e, !!m.h, m.by === Net.me.id ? 0 : 1); if (m.by === Net.me.id) HUD.hit(true); } }
    else if (m.t === 'wave') { G.wave = m.w; G.phase = 'fight'; HUD.banner(m.boss ? 'BOSS WAVE' : 'WAVE ' + m.w, m.boss ? 'something big is coming over the wall' : 'ashen inbound'); Snd.boom(0.5); }
    else if (m.t === 'clear') { G.phase = 'break'; G.phaseT = 22; G.cash += m.bonus; G.earned += m.bonus; HUD.banner('WAVE ' + m.w + ' CLEAR', '+$' + m.bonus + '    the supply crate is open: B'); Snd.ui('buy'); if (P.dead) G.revive(); else P.hp = Math.min(P.max, P.hp + 25); }
    else if (m.t === 'over') G.finish();
    else if (m.t === 'feed') { if (m.you) G.pvpKill(null, !!m.head); else HUD.feed(m.txt); }
    else if (m.t === 'score') { for (const s of m.r) { const r = Net.roster.find(x => x.id === s[0]); if (r) { r.kills = s[1]; r.deaths = s[2]; r.pts = s[4] || 0; if (s[3] !== undefined && r.team !== s[3]) { r.team = s[3]; Modes.teamChanged(r); } } } Net.scores(); }
    else if (m.t === 'end') G.finishMatch(m.win);
    else if (m.t === 'left') { const p = G.players[Net.idx[m.id]]; if (p) { p.gone = true; p.dead = true; } }
    else if (m.t === 'heal') Net.healNear(m.x, m.z);
};
Net.healNear = function (x, z) { const P = Game.P; if (!P.dead && Math.hypot(P.x - x, P.z - z) < 8) { P.hp = Math.min(P.max, P.hp + 50); HUD.feed('<b>PATCHED UP</b> +50'); Snd.ui('buy'); } };

// ---- the match
Net.startMatch = function () {
    if (!Net.host || Net.state !== 'lobby') return; const c = Net.cfg;
    Net.roster = Net.roster.filter(r => !r.bot); for (const r of Net.roster) { r.kills = 0; r.deaths = 0; r.gone = false; }
    if (c.mode !== 'coop') { const used = {}; for (let i = 0; i < c.bots && Net.roster.length < MP_MODES[c.mode].max; i++) { let n; do { n = BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0]; } while (used[n]); used[n] = 1; const b = Net.entry('b' + i, n, true); b.kit = ['carbine', 'carbine', 'smg'][i % 3]; Net.roster.push(b); } }
    if (c.mode === 'gg') { c.gg = GG_ORDER.filter(id => Weapons.made(id)); c.goal = c.gg.length; }
    Net.roster.forEach((r, i) => { r.team = MP_MODES[c.mode].teams ? (c.mode === 'inf' ? 0 : i % 2) : -1; r.pts = 0; });
    Net.all({ t: 'start', cfg: c, roster: Net.roster }); Net.begin();
};
Net.begin = async function () {
    Net.state = 'game'; Net.idx = {}; Net.hits = []; Net.sendT = Net.snapT = 0; Ticker.start(); const mine = Net.roster.find(r => r.id === Net.me.id) || Net.roster[0];
    if (HAVE.soldier && !Net.soldier) { try { const S = await HG3D.load(AST('soldier.hgm'), { anisotropy: 1 }); if (S.skins.soldier) Net.soldier = S; } catch (e) { } }
    const ok = await UI.play({ map: Net.cfg.map, diff: Net.cfg.diff, cls: mine.cls, kit: Modes.kit(mine), net: { host: Net.host, mode: Net.cfg.mode, goal: Net.cfg.goal, team: mine.team } });
    if (!ok) Net.leave();
};
// the game asks for the other players of this match (Game.players[0] is always the one here)
Net.others = function () {
    const out = []; let k = 1; Net.idx = {}; Net.idx[Net.me.id] = 0;
    for (const r of Net.roster) { if (r.id === Net.me.id) continue; Net.idx[r.id] = k++; out.push({ id: r.id, name: r.name, bot: r.bot, kit: r.kit, team: r.team, x: World.home[0], z: World.home[1], tx: World.home[0], tz: World.home[1], yaw: 0, ta: 0, pitch: 0, hp: 100, max: 100, dead: false, gone: false, fire: 0, moving: 0, t: Math.random() * 3, dieT: 0, light: new Float32Array([1, 1, 1, 1]), safe: 0, cool: 0, tgt: -1, lastBy: '' }); }
    if (!Net.avatars) { const S = Net.soldier, B = S ? null : (Foes.crowds.walker || Foes.base); if (S || B) { const c = Net.avatars = S ? S.crowd('soldier', 12) : B.A.crowd('enemy', 12); c.soldier = !!S; c.fromMap = !S && B === Foes.base; for (const m of c.node.children) m.frustumCulled = false; World.scene.add(c.node); } }
    return out;
};
// a player's state as others send it: [x, z, yaw, pitch, hp, flags, weapon]; flags: 1 down, 2 firing, 4 safe
Net.pack = function (p, mine) { return [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, Math.round((mine ? p.yaw + Math.PI : p.ta) * 100) / 100, Math.round(p.pitch * 100) / 100, Math.round(p.hp), (p.dead ? 1 : 0) | (p.fire > 0 || (mine && p.flashT > 0) ? 2 : 0) | (p.safe > 0 ? 4 : 0), mine ? (Gun.cur ? Gun.cur.id : '') : p.kit]; };
Net.take = function (p, s) { p.tx = s[0]; p.tz = s[1]; p.ta = s[2]; p.pitch = s[3]; p.hp = s[4]; const was = p.dead; p.dead = !!(s[5] & 1) || p.gone; if (p.dead && !was) p.dieT = 0; if (!p.dead && was) { p.x = p.tx; p.z = p.tz; } if (s[5] & 2) p.fire = 0.12; p.safe = s[5] & 4 ? 0.3 : 0; p.kit = s[6] || p.kit; };
// once a frame, for everyone: send where we are; the host also sends everyone (and the ashen) to everyone
Net.step = function (dt) {
    const G = Game, P = G.P; if (!Net.on || Net.state !== 'game') return;
    // the others move toward where they were last said to be
    for (let k = 1; k < G.players.length; k++) { const p = G.players[k]; if (p.bot && Net.host) continue; const f = Math.min(1, dt * 12), dx = p.tx - p.x, dz = p.tz - p.z; p.moving = lerp(p.moving, Math.hypot(dx, dz) > 0.03 ? 1 : 0, Math.min(1, dt * 8)); p.x += dx * f; p.z += dz * f; let da = p.ta - p.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.yaw += da * f; }
    if (G.mode === 'dm') { if (Net.host) { Modes.hostStep(G, dt); Net.bots(dt); } Modes.step(G, dt); }
    for (let k = 1; k < G.players.length; k++) { const p = G.players[k]; p.t += dt; if (p.dead) p.dieT += dt; if (p.fire > 0) { if (p.fire === 0.12 || (p.bot && p.shotNow)) Net.gunfire(p); p.fire -= dt; p.shotNow = false; } }
    Net.sendT -= dt; if (Net.sendT > 0) return; Net.sendT = 1 / 15;
    if (!Net.host) { Net.send(Net.peers.H, { t: 'S', s: Net.pack(P, true) }, true); if (Net.hits.length) { Net.send(Net.peers.H, { t: 'h', l: Net.hits }); Net.hits = []; } return; }
    const m = { t: 'P', p: [['H'].concat(Net.pack(P, true))] }; for (let k = 1; k < G.players.length; k++) { const p = G.players[k]; if (!p.gone) m.p.push([p.id].concat(Net.pack(p, false))); }
    if (G.mode !== 'dm') { Net.snapT -= 1; if (Net.snapT <= 0) { Net.snapT = 2; m.e = Foes.list.map(e => [e.id, FOE_IDS.indexOf(e.type), Math.round(e.x * 50) / 50, Math.round(e.z * 50) / 50, Math.round(e.yaw * 50) / 50, e.state === 'die' ? 2 : Kinds.hidden(e) ? 3 : e.state === 'attack' ? 1 : 0, Math.round(e.size * 100) / 100, Math.round(e.speed * 10) / 10]); m.g = [G.wave, G.phase === 'fight' ? 1 : 0, Math.ceil(G.phaseT), G.toSpawn.length]; } }
    else { m.g = [Math.ceil(G.matchT)]; const x = Modes.pack(G); if (x) m.x = x; }
    Net.all(m, true);
};
// a guest takes the host's picture of the world
Net.snapshot = function (m) {
    const G = Game;
    for (const s of m.p) { if (s[0] === Net.me.id) continue; const p = G.players[Net.idx[s[0]]]; if (p) Net.take(p, s.slice(1)); }
    if (m.x) Modes.take(G, m.x);
    if (m.g) { if (G.mode === 'dm') G.matchT = m.g[0]; else { G.wave = m.g[0]; G.phase = m.g[1] ? 'fight' : 'break'; if (!m.g[1]) G.phaseT = m.g[2]; G.toSpawn.length = m.g[3]; } }
    if (!m.e) return; const seen = {};
    for (const s of m.e) { seen[s[0]] = 1; let e = Foes.list.find(x => x.id === s[0]); if (!e) { e = Foes.spawn(FOE_IDS[s[1]], s[2], s[3], 1, 1); e.id = s[0]; e.born = 0.5; e.size = s[6]; e.speed = s[7]; e.yaw = s[4]; } e.tx = s[2]; e.tz = s[3]; e.ta = s[4]; e.under = s[5] === 3; const st = s[5] === 2 ? 'die' : s[5] === 1 ? 'attack' : 'walk'; if (st !== e.state && e.state !== 'die') { e.state = st; e.t = 0; } }
    for (let i = Foes.list.length - 1; i >= 0; i--) { const e = Foes.list[i]; if (!seen[e.id] && e.state !== 'die') Foes.list.splice(i, 1); }
};
// a guest's ashen: glide to where the host last said, keep the clip running
Net.guestStep = function (dt) {
    const f = Math.min(1, dt * 10);
    for (let i = Foes.list.length - 1; i >= 0; i--) { const e = Foes.list[i], C = Foes.crowdOf(e.type), dieLen = C ? C.dieLen : 1; e.t += dt; e.flash = Math.max(0, e.flash - dt * 6); if (e.state === 'die') { if (e.t > dieLen + 2.5) Foes.list.splice(i, 1); continue; } e.born = Math.max(0, e.born - dt); if (e.tx === undefined) continue; e.x += (e.tx - e.x) * f; e.z += (e.tz - e.z) * f; let da = e.ta - e.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; e.yaw += da * f; }
};
Net.event = function (t, d) { const m = Object.assign({ t }, d); if (Net.host) { if (t === 'k') m.by = d.by >= 0 && Game.players[d.by] ? (d.by === 0 ? 'H' : Game.players[d.by].id) : ''; Net.all(m); } else if ((t === 'dead' || t === 'heal') && Net.peers.H) Net.send(Net.peers.H, m); };
Net.hitFoe = function (id, dmg, head) { Net.hits.push([id, Math.round(dmg), head ? 1 : 0]); };
Net.hurt = function (k, dmg, fx, fz) { const p = Game.players[k]; if (p && Net.peers[p.id]) Net.send(Net.peers[p.id], { t: 'd', dmg: Math.round(dmg * 10) / 10, fx, fz }); };
Net.checkOver = function () { const G = Game; if (Net.host && G.mode !== 'dm' && !G.over && !G.players.some(p => !p.dead && !p.gone)) G.finish(); };
// someone else fired: the sound from where they stand, and a streak along their aim
Net.gunfire = function (p) {
    const P = Game.P, d = Math.hypot(p.x - P.x, p.z - P.z), w = WEAPONS[p.kit] || WEAPONS.carbine, cp = Math.cos(p.pitch), ux = Math.sin(p.yaw) * cp, uy = Math.sin(p.pitch), uz = Math.cos(p.yaw) * cp;
    Snd.gun(w.snd, clamp(1.1 - d / 45, 0.08, 0.9)); const t = World.ray(p.x, 1.45, p.z, ux, uy, uz, 60); World.tracer(p.x + ux * 0.6, 1.4, p.z + uz * 0.6, p.x + ux * t, 1.45 + uy * t, p.z + uz * t); World.sparks.add(p.x + ux * 0.7, 1.4, p.z + uz * 0.7, 0, 0, 0, 0.3, -2, 0.06, 1, 1, 1, 1);
};

// ---- deathmatch
// a bullet's path against the other players (for the one shooting): the nearest one hit before `max`
const NH = { p: null, t: 0, head: false };
Net.trace = function (ox, oy, oz, ux, uy, uz, max) {
    const G = Game, hl = ux * ux + uz * uz; NH.p = null; NH.t = max; NH.head = false; if (hl < 1e-6) return NH;
    for (let k = 1; k < G.players.length; k++) { const p = G.players[k]; if (p.dead || p.gone || (G.teams && p.team === G.P.team)) continue; const t = ((p.x - ox) * ux + (p.z - oz) * uz) / hl; if (t < 0 || t > NH.t) continue; const px = ox + ux * t - p.x, pz = oz + uz * t - p.z, y = oy + uy * t; if (px * px + pz * pz < 0.34 * 0.34 && y > 0.05 && y < 1.85) { NH.p = p; NH.t = t; NH.head = y > 1.5; } }
    return NH;
};
Net.hitPlayer = function (p, dmg, head, w) { if (p.safe > 0) return; if (Net.host) Net.pvpHit('H', p.id, dmg, head, w); else Net.send(Net.peers.H, { t: 'ph', to: p.id, dmg: Math.round(dmg), head: head ? 1 : 0, w }); World.blood(p.x, head ? 1.6 : 1.1, p.z, head ? 6 : 3); };
// the host passes a hit on to the one it struck (or takes it off a bot)
Net.pvpHit = function (from, to, dmg, head, w) {
    const G = Game; if (G.mode !== 'dm' || G.over || (G.teams && Net.teamOf(from) === Net.teamOf(to))) return; const a = from === 'H' ? G.P : G.players[Net.idx[from]], m = { t: 'pd', by: from, dmg, head: head ? 1 : 0, w: w || '', fx: a ? a.x : 0, fz: a ? a.z : 0 };
    if (to === 'H') Net.takeHit(m); else { const v = G.players[Net.idx[to]]; if (!v || v.dead || v.gone || v.safe > 0) return; if (v.bot) { v.hp -= dmg; v.lastBy = from; v.hunt = Net.idx[from] || 0; if (v.hp <= 0) { v.dead = true; v.dieT = 0; v.respawn = 3; Net.scoreKill(from, to, head, w); } } else if (Net.peers[to]) Net.send(Net.peers[to], m); }
};
// we were hit by another player
Net.takeHit = function (m) { const G = Game, P = G.P; if (P.dead || P.safe > 0) return; P.lastBy = m.by; P.lastHead = !!m.head; P.lastW = m.w; G.hurt(0, m.dmg, m.fx, m.fz, null); };
Net.scoreKill = function (by, dead, head, w) {
    const G = Game, a = Net.roster.find(r => r.id === by), v = Net.roster.find(r => r.id === dead); if (v) v.deaths++; if (a && a !== v) a.kills++; const win = Modes.kill(G, a && a !== v ? a : null, v);
    const txt = (a && a !== v ? '<b>' + esc(a.name) + '</b> ' + (head ? '&#9678; ' : '') + '&rsaquo; ' : '') + esc(v ? v.name : '?') + (a && a !== v ? '' : ' fell'); Net.all({ t: 'feed', txt }); HUD.feed(txt);
    const sc = { t: 'score', r: Net.roster.map(r => [r.id, r.kills, r.deaths, r.team, r.pts || 0]) }; Net.all(sc); Net.scores();
    if (by === 'H' && a !== v) G.pvpKill(v, head);
    else if (by !== 'H' && a !== v && Net.peers[by]) Net.send(Net.peers[by], { t: 'feed', txt: '', you: 1, head: head ? 1 : 0 });
    if (win) { Net.all({ t: 'end', win }); G.finishMatch(win); }
};
Net.scores = function () {
    const md = Net.cfg.mode, tdm = !!MP_MODES[md].teams, tk = md === 'koth' || md === 'kc' || md === 'ctf' ? Game.pts || [0, 0] : Net.teamKills(), rows = Net.roster.slice().sort((a, b) => (tdm ? a.team - b.team : 0) || b.kills - a.kills || a.deaths - b.deaths); let last = -2;
    $('scores').innerHTML = '<table><tr><th>' + MP_MODES[Net.cfg.mode].name + '</th><th>KILLS</th><th>DEATHS</th></tr>' + rows.map(r => { let h = ''; if (tdm && r.team !== last) { last = r.team; h = '<tr><th style="color:' + (r.team ? '#ff9a7a' : '#9fd0ff') + '">' + Modes.side(r.team) + '</th><th>' + (md === 'inf' ? '' : tk[r.team]) + '</th><th></th></tr>'; } return h + '<tr class="' + (r.id === Net.me.id ? 'me' : '') + '"><td>' + esc(r.name) + (r.bot ? ' <small>bot</small>' : '') + (md === 'hunt' ? ' <b>' + (r.pts || 0) + '</b>' : '') + '</td><td>' + r.kills + '</td><td>' + r.deaths + '</td></tr>'; }).join('') + '</table>';
    Game.lead = rows.slice().sort((a, b) => b.kills - a.kills)[0]; Game.teamK = tk;
};
// bots (host): walk the flow toward whoever they hunt, shoot when they see them
Net.bots = function (dt) {
    const G = Game, PL = G.players; Net.botT -= dt; const think = Net.botT <= 0; if (think) Net.botT = 0.25;
    for (let k = 1; k < PL.length; k++) { const b = PL[k]; if (!b.bot) continue;
        if (b.dead) { b.respawn -= dt; if (b.respawn <= 0) { const s = Game.spawnSpot(); b.x = b.tx = s[0]; b.z = b.tz = s[1]; b.hp = 100; b.dead = false; b.safe = 2; b.tgt = -1; } continue; }
        b.safe = Math.max(0, b.safe - dt); b.cool -= dt;
        if (think || b.tgt < 0 || !PL[b.tgt] || PL[b.tgt].dead) { let bd = 1e9, bt = -1; for (let j = 0; j < PL.length; j++) { if (j === k) continue; const p = PL[j]; if (p.dead || p.gone || (G.teams && p.team === b.team)) continue; const d = Math.hypot(p.x - b.x, p.z - b.z) * (j === b.hunt ? 0.5 : 1); if (d < bd) { bd = d; bt = j; } } b.tgt = bt; }
        const T = PL[b.tgt]; if (!T) continue; const dx = T.x - b.x, dz = T.z - b.z, d = Math.hypot(dx, dz), sees = d < 45 && World.sees(b.x, b.z, T.x, T.z, 1.45);
        let tx = dx, tz = dz; if (!sees || d > 14) { const F = (!sees && Modes.botFlow(G, b)) || G.flows[b.tgt]; if (F) { const c = World.cell(b.x, b.z), n = World.next(F, c); if (n !== c) { tx = World.cellX(n) - b.x; tz = World.cellZ(n) - b.z; } } }
        const want = Math.atan2(sees ? dx : tx, sees ? dz : tz); let da = want - b.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; b.yaw += da * Math.min(1, dt * 6); b.ta = b.yaw; b.pitch = 0;
        const mel = Modes.melee(b), go = !sees || d > (mel ? 1.4 : 9), ml = Math.hypot(tx, tz) || 1, sp = 3.4 * dt; if (go) { const sx = tx / ml * sp, sz = tz / ml * sp; if (!World.blocked(b.x + sx, b.z, 0.3)) b.x += sx; if (!World.blocked(b.x, b.z + sz, 0.3)) b.z += sz; } b.moving = lerp(b.moving, go ? 1 : 0, Math.min(1, dt * 8)); b.tx = b.x; b.tz = b.z;
        if (sees && Math.abs(da) < 0.25 && b.cool <= 0 && (!mel || d < 2.3)) { b.cool = mel ? 0.9 : b.burst > 0 ? 0.11 : rand(0.5, 1.1); b.burst = b.burst > 0 ? b.burst - 1 : 3 + (Math.random() * 3 | 0); b.fire = mel ? 0 : 0.1; b.shotNow = !mel; b.safe = 0;
            if (mel || Math.random() < clamp(0.5 - d * 0.012, 0.12, 0.5) * (T.moving > 0.5 ? 0.7 : 1)) Net.pvpHit(b.id, b.tgt === 0 ? 'H' : T.id, mel ? 50 : 17, !mel && Math.random() < 0.08, mel ? 'knife' : 'carbine'); }
    }
};
// draw the others (for now the hooded figure in a team colour; a soldier model replaces it), and their names
Net.render = function (V) {
    const G = Game, C = Net.avatars, A = World.A; if (!C) return; C.begin(); const cl = C.clips, dm = G.mode === 'dm', cam = World.camera, w = cam.matrixWorld.elements, tf = Math.tan(cam.fov * Math.PI / 360);
    for (let k = 1; k < G.players.length; k++) { const p = G.players[k], foe = dm && !(G.teams && p.team === G.P.team); let tag = Net.tags[p.id];
        if (p.gone || (p.dead && p.dieT > 4)) { if (tag) tag.style.display = 'none'; continue; }
        const clip = p.dead ? cl.die : p.fire > 0 && cl.fire ? cl.fire : p.moving > 0.4 ? (cl.run || cl.walk) : (cl.idle || cl.walk), L = p.light; A.probe(p.x, p.z, L); const sun = L[3], tk = C.soldier ? 0.5 : 1;      // a soldier needs less tint to read as a side
        if (foe) { L[0] *= 1 + 0.5 * tk; L[1] *= 1 - 0.25 * tk; L[2] *= 1 - 0.4 * tk; } else { L[0] *= 1 - 0.4 * tk; L[1] *= 1 - 0.05 * tk; L[2] *= 1 + 0.6 * tk; } if (p.safe > 0) { L[0] += 0.5; L[1] += 0.5; L[2] += 0.5; }
        C.add(p.x, 0, p.z, p.yaw, 0.97, A.frame(clip, p.dead ? Math.min(p.dieT, (cl.die.count - 1) / cl.die.fps) : p.t * (p.moving > 0.4 ? 1.5 : 1)), L, p.fire > 0 ? 0.25 : 0, Math.hypot(p.x - V.x, p.z - V.z));
        World.shFigure(p.x, p.z, p.dead ? 0.5 : 1.75, sun);
        // the name over their head (friends always; in deathmatch only when close and in sight)
        if (!tag) { tag = Net.tags[p.id] = document.createElement('div'); tag.className = 'tag'; tag.textContent = p.name; $('hud').appendChild(tag); }
        const rx = p.x - w[12], ry = 2.05 - w[13], rz = p.z - w[14], vz = -(rx * w[8] + ry * w[9] + rz * w[10]), dist = Math.hypot(rx, rz), show = !p.dead && vz > 0.5 && (foe ? dist < 16 && World.sees(V.x, V.z, p.x, p.z, 1.5) : dist < 60);
        if (show) { tag.style.display = ''; tag.style.transform = 'translate(' + ((0.5 + (rx * w[0] + ry * w[1] + rz * w[2]) / (vz * tf * cam.aspect) / 2) * innerWidth).toFixed(0) + 'px,' + ((0.5 - (rx * w[4] + ry * w[5] + rz * w[6]) / (vz * tf) / 2) * innerHeight).toFixed(0) + 'px) translate(-50%,-100%)'; tag.classList.toggle('foe', foe); } else tag.style.display = 'none';
    }
    C.end();
};

// ---- the party screen
Net.panelHTML = function () {
    const c = Net.cfg, M = MP_MODES[c.mode], host = Net.host, me = Net.roster.find(r => r.id === Net.me.id) || { cls: UI.setup.cls, kit: UI.setup.kit || 'carbine' };
    if (!Net.on || Net.state === 'idle') return '<div class="cols"><div><div class="h3">Your name</div><div class="row"><input type="text" data-netin="name" maxlength="14" value="' + esc(Save.data.name || '') + '" placeholder="Drifter" style="width:220px"></div>' +
        '<div class="h3" style="margin-top:18px">Start a party</div><p style="color:#b9b2a6">You get a 6-digit code. Friends type it in and you play together: no account, any network that lets browsers talk.</p><button class="btn go" data-net="host">HOST A PARTY</button><div class="h3" style="margin-top:18px">No friends on right now?</div><p style="color:#b9b2a6">Every kind of match can be played against bots, by yourself.</p><button class="btn" data-net="solo">PLAY AGAINST BOTS</button></div>' +
        '<div><div class="h3">Join a party</div><div class="row"><input type="text" data-netin="code" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="width:160px;font-size:22px;letter-spacing:.2em"><button class="btn go" data-net="join">JOIN</button></div>' + (Net.err ? '<p style="color:var(--bad)">' + esc(Net.err) + '</p>' : '') + '</div></div>';
    if (Net.state === 'opening' || Net.state === 'joining') return '<p style="letter-spacing:.2em;animation:pulse 1.2s infinite">' + (Net.state === 'opening' ? 'OPENING A PARTY...' : 'LOOKING FOR PARTY ' + esc(Net.code) + '...') + '</p><button class="btn" data-net="leave">CANCEL</button>';
    const kits = Weapons.list().filter(id => WEAPONS[id].slot === 1 && Save.rank().index >= WEAPONS[id].rank);
    return '<div class="cols"><div><div class="h3">Party code</div><div style="font:900 54px/1 Arial Black,Roboto,sans-serif;letter-spacing:.18em;color:var(--ember2);user-select:text;-webkit-user-select:text">' + (Net.code ? esc(Net.code) : 'BOTS') + '</div><p style="color:var(--dim)">' + (Net.code ? 'Friends: MULTIPLAYER, type this code, JOIN.' : 'A match by yourself against bots. To play with friends, leave and host a party.') + '</p>' +
        '<div class="h3">In the party (' + Net.roster.length + '/' + M.max + ')</div>' + Net.roster.map(r => '<div class="row"><label>' + esc(r.name) + (r.id === 'H' ? ' <small style="display:inline;color:var(--ember2)">HOST</small>' : '') + (r.id === Net.me.id ? ' <small style="display:inline">you</small>' : '') + '</label><small>' + (c.mode !== 'coop' ? WEAPONS[r.kit].name : CLASSES[r.cls].name) + '</small></div>').join('') + '</div>' +
        '<div><div class="h3">The match' + (host ? '' : ' (the host chooses)') + '</div><div class="seg">' + Object.keys(MP_MODES).map(id => '<button data-net="mode" data-v="' + id + '" class="' + (c.mode === id ? 'on' : '') + '"' + (host ? '' : ' disabled') + '>' + MP_MODES[id].name + '</button>').join('') + '</div><p style="color:#b9b2a6">' + M.blurb + '</p>' +
        (UI.maps().length > 1 ? '<div class="seg" style="margin-bottom:10px">' + UI.maps().map(id => '<button data-net="map" data-v="' + id + '" class="' + (c.map === id ? 'on' : '') + '"' + (host ? '' : ' disabled') + '>' + MAPS[id].name + '</button>').join('') + '</div>' : '') +
        (c.mode === 'coop' ? '<div class="seg">' + Object.keys(DIFFS).map(id => '<button data-net="diff" data-v="' + id + '" class="' + (c.diff === id ? 'on' : '') + '"' + (host ? '' : ' disabled') + '>' + DIFFS[id].name + '</button>').join('') + '</div><div class="h3" style="margin-top:14px">Your class</div><div class="tiles">' + UI.classTiles(me.cls) + '</div>'
            : '<div class="row"><label>Kills to win' + (c.mode === 'tdm' || c.mode === 'kc' ? '<small>a side needs twice this</small>' : c.mode !== 'dm' ? '<small>this kind of match has its own goal</small>' : '') + '</label><div class="seg">' + [10, 15, 25].map(n => '<button data-net="goal" data-v="' + n + '" class="' + (c.goal === n ? 'on' : '') + '"' + (host ? '' : ' disabled') + '>' + n + '</button>').join('') + '</div></div><div class="row"><label>Bots</label><div class="seg">' + [0, 1, 3, 5].map(n => '<button data-net="bots" data-v="' + n + '" class="' + (c.bots === n ? 'on' : '') + '"' + (host ? '' : ' disabled') + '>' + n + '</button>').join('') + '</div></div><div class="h3" style="margin-top:14px">Your rifle</div><div class="tiles">' + kits.map(id => '<button class="tile' + (me.kit === id ? ' sel' : '') + '" data-net="kit" data-v="' + id + '"><b>' + WEAPONS[id].name + '</b><small>' + WEAPONS[id].kind + '</small></button>').join('') + '</div>') +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn" data-net="leave">LEAVE</button>' + (host ? '<button class="btn go" data-net="start">START</button>' : '<span style="align-self:center;letter-spacing:.14em;color:var(--dim)">WAITING FOR THE HOST</span>') + '</div></div></div>';
};
Net.click = function (d) {
    const a = d.net, c = Net.cfg; Snd.ui('click');
    if (a === 'host') Net.hostGame(); else if (a === 'solo') Net.solo(); else if (a === 'join') { const i = document.querySelector('[data-netin=code]'); Net.join(i ? i.value : ''); } else if (a === 'leave') { Net.leave(); setTimeout(() => UI.draw(), 80); }
    else if (a === 'start') Net.startMatch();
    else if (a === 'kit') { UI.setup.kit = d.v; Net.setCls(); }
    else if (Net.host) { if (a === 'mode') c.mode = d.v; else if (a === 'map') c.map = d.v; else if (a === 'diff') c.diff = d.v; else if (a === 'goal') c.goal = +d.v; else if (a === 'bots') c.bots = +d.v; Net.lobby(); }
};
Net.setCls = function () { if (!Net.on) return; const me = Net.roster.find(r => r.id === Net.me.id); if (me) { me.cls = UI.setup.cls; me.kit = UI.setup.kit || 'carbine'; } if (Net.host) Net.lobby(); else if (Net.peers.H) Net.send(Net.peers.H, { t: 'kit', cls: UI.setup.cls, kit: UI.setup.kit || 'carbine' }); if (UI.panel === 'mp') UI.draw(); };
Net.input = function (t) { if (t.dataset.netin === 'name') { Save.data.name = t.value.slice(0, 14); Save.store(); } };
