// ============================================================
// MULTIPLAYER: a party found by a 6-digit code (PeerJS's free matchmaking, then browser to browser), the way Ashfall and
// Blocky Shooter do it. The host's computer is the referee: it runs the bots, keeps every vehicle's health, the score, the
// rings and the flags, and brings crews back. Each computer drives its own vehicle and says where it is 15 times a
// second; it flies its own shells and tells the host what they hit. Shells other people fired are drawn but do nothing
// (cos: true). Each computer sees its own side as side 0 (olive): Net.lt turns a real side into the local one.
// ============================================================
const NET_V = 2, PJ_PREFIX = 'steelstorm-r1-';
const Net = { on: false, host: false, state: 'idle', code: '', err: '', pj: null, peers: {}, me: { id: 'H', name: '' }, roster: [], cfg: { mode: 'tdm', map: '', size: 4, skill: 'normal', wx: 'clear', len: 'normal', ff: false }, sendT: 0, out: [], life: 0, myTeam: 0, chat: [], full: null, late: false };
Net.loadPeer = function () {
    if (window.Peer) return Promise.resolve(window.Peer); if (Net.pjLoading) return Net.pjLoading;
    return Net.pjLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = () => window.Peer ? res(window.Peer) : rej(new Error('The matchmaking helper did not load.')); s.onerror = () => { Net.pjLoading = null; rej(new Error('Could not reach the matchmaking service. Are you online?')); }; document.head.appendChild(s); });
};
Net.wire = function (conn, id) {
    const pc = conn.peerConnection, rel = conn.dataChannel, fast = pc.createDataChannel('u', { negotiated: true, id: 50, ordered: false, maxRetransmits: 0 }), peer = { id, conn, rel, fast };
    const on = e => { let m; try { m = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data)); } catch (x) { return; } if (m && m.t) (Net.host ? Net.hostMsg : Net.guestMsg)(m, peer); };
    rel.addEventListener('message', on); fast.addEventListener('message', on);
    const gone = () => { if (peer.dead) return; peer.dead = true; if (Net.host) Net.hostLost(peer); else Net.hostGone(); };
    conn.on('close', gone); conn.on('error', gone); pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') gone(); });
    return peer;
};
Net.send = function (peer, m, fast) { try { const ch = fast && peer.fast.readyState === 'open' ? peer.fast : peer.rel; if (ch.readyState === 'open') ch.send(JSON.stringify(m)); } catch (e) { } };
Net.all = function (m, fast, but) { for (const id in Net.peers) if (id !== but) Net.send(Net.peers[id], m, fast); };
Net.name = () => (Save.data.name || '').trim().slice(0, 14) || 'Commander';
Net.lobby = function () { if (Net.host) Net.all({ t: 'lobby', cfg: Net.cfg, roster: Net.roster }); Net.redraw(); };
// draw the party page again without losing what is being typed in the chat box
Net.redraw = function () { if (UI.tab !== 'mp' || App.game) return; const el = document.querySelector('[data-netin=chat]'), v = el ? el.value : '', f = !!el && document.activeElement === el; UI.page(); const e2 = document.querySelector('[data-netin=chat]'); if (e2) { e2.value = v; if (f) e2.focus(); } const box = document.getElementById('net-chat'); if (box) box.scrollTop = 1e6; };
Net.hostGame = async function (tries) {
    Net.reset(); Net.on = true; Net.host = true; Net.state = 'opening'; Net.me = { id: 'H', name: Net.name() }; Net.cfg.map = Net.cfg.map || UI.map; Net.roster = [{ id: 'H', name: Net.me.name, veh: Save.data.veh, team: 0, ready: true }]; UI.page();
    try {
        const Peer = await Net.loadPeer(); if (!Net.host || Net.state !== 'opening') return;
        const code = String(100000 + Math.floor(Math.random() * 900000)), pj = Net.pj = new Peer(PJ_PREFIX + code, { debug: 0 });
        pj.on('open', () => { if (Net.pj !== pj) return; Net.code = code; Net.state = 'lobby'; UI.page(); });
        pj.on('error', e => { if (Net.pj !== pj) return; if (e.type === 'unavailable-id' && (tries || 0) < 6) { pj.destroy(); Net.hostGame((tries || 0) + 1); return; } if (Net.state === 'opening') Net.fail('Could not open a party (' + e.type + ').'); });
        pj.on('disconnected', () => { if (Net.pj === pj && !pj.destroyed) setTimeout(() => { try { pj.reconnect(); } catch (e) { } }, 1500); });
        pj.on('connection', conn => conn.on('open', () => { if (conn.label !== 'steelstorm') { conn.close(); return; } const peer = Net.wire(conn, ''); peer.pending = true; setTimeout(() => { if (peer.pending) try { conn.close(); } catch (e) { } }, 8000); }));
    } catch (e) { Net.fail(e.message); }
};
Net.join = async function (raw, attempt) {
    const code = String(raw || '').replace(/\D/g, ''); if (code.length !== 6) { Net.err = 'Party codes are 6 digits.'; UI.page(); return; }
    Net.reset(); Net.on = true; Net.host = false; Net.state = 'joining'; Net.code = code; Net.me = { id: '', name: Net.name() }; UI.page();
    try {
        const Peer = await Net.loadPeer(); if (Net.state !== 'joining') return; const pj = Net.pj = new Peer({ debug: 0 }); let done = false;
        const fail = (msg, retry) => { if (done || Net.pj !== pj) return; done = true; clearTimeout(timer); try { pj.destroy(); } catch (e) { } if (retry && (attempt || 0) < 2) { setTimeout(() => Net.join(code, (attempt || 0) + 1), 1200); return; } Net.fail(msg); };
        const timer = setTimeout(() => fail('Could not connect in time. Check the code; a school network may be blocking it.', true), 15000);
        pj.on('error', e => fail(e.type === 'peer-unavailable' ? 'No party has the code ' + code + '.' : 'Connection problem (' + e.type + ').', e.type !== 'peer-unavailable'));
        pj.on('open', () => { const conn = pj.connect(PJ_PREFIX + code, { label: 'steelstorm', serialization: 'raw', reliable: true });
            conn.on('open', () => { if (done) return; done = true; clearTimeout(timer); const peer = Net.wire(conn, 'H'); Net.peers = { H: peer }; Net.send(peer, { t: 'hi', name: Net.me.name, v: NET_V, veh: Save.data.veh }); setTimeout(() => { try { pj.disconnect(); } catch (e) { } }, 1500); }); });
    } catch (e) { Net.fail(e.message); }
};
Net.fail = function (msg) { Net.reset(); Net.err = msg; if (UI.tab === 'mp') UI.page(); };
Net.reset = function () { for (const id in Net.peers) try { Net.peers[id].conn.close(); } catch (e) { } if (Net.pj) try { Net.pj.destroy(); } catch (e) { } Net.pj = null; Net.peers = {}; Net.on = false; Net.host = false; Net.state = 'idle'; Net.code = ''; Net.err = ''; Net.roster = []; Net.out = []; Net.chat = []; Net.full = null; Net.late = false; };
Net.leave = function () { if (!Net.on) return; if (Net.host) Net.all({ t: 'bye' }); else if (Net.peers.H) Net.send(Net.peers.H, { t: 'bye' }); setTimeout(() => Net.reset(), 60); Game.net = null; };
Net.hostGone = function () { if (!Net.on || Net.host) return; const inGame = App.game && Game.net; Net.reset(); Net.err = 'The host left the party.'; if (inGame) { Game.net = null; Game.stop(); UI.menu(); } UI.tab = 'mp'; UI.page(); };
Net.hostLost = function (peer) {
    if (!peer.id) return; delete Net.peers[peer.id]; const i = Net.roster.findIndex(r => r.id === peer.id); if (i < 0) return;
    if (Net.state === 'game') { const r = Game.roster.find(x => x.id === peer.id); if (r) { r.bot = true; r.remote = false; r.held = false; if (r.U && !r.U.dead) { r.U.remote = false; Units.brain(r.U, 0.4); } HUD.feed(esc(r.name) + ' left: a bot has the vehicle'); } Net.roster.splice(i, 1); } else { Net.roster.splice(i, 1); Net.lobby(); }
};
// the vehicle picked in the garage, told to the party while it waits
Net.kit = function () { if (!Net.on || Net.state !== 'lobby') return; const v = Save.data.veh; if (Net.host) { Net.roster[0].veh = v; Net.lobby(); } else if (Net.peers.H) Net.send(Net.peers.H, { t: 'kit', veh: v }); };
// a real side as this computer sees it (its own side is always 0)
Net.lt = t => Net.myTeam === 1 && t < 2 ? 1 - t : t;

// ---- the host hears a guest
Net.hostMsg = function (m, peer) {
    const G = Game;
    if (m.t === 'hi') {
        if (m.v !== NET_V) { Net.send(peer, { t: 'no', why: 'This party runs another version. Reload the game.' }); return; }
        const nm = String(m.name || 'Commander').slice(0, 14), veh = VEHS[m.veh] ? m.veh : 'mt1'; let n = 1; while (Net.peers['p' + n] || (Net.state === 'game' && G.roster.some(x => x.id === 'p' + n))) n++;
        if (Net.state === 'game') { Net.lateJoin(peer, 'p' + n, nm, veh); return; }
        if (Net.state !== 'lobby' || Net.roster.length >= 8) { Net.send(peer, { t: 'no', why: Net.state !== 'lobby' ? 'That party is not open yet. Try again in a moment.' : 'That party is full.' }); return; }
        peer.id = 'p' + n; peer.pending = false; Net.peers[peer.id] = peer; Net.roster.push({ id: peer.id, name: nm, veh, ready: false, team: Net.roster.filter(r => r.team === 0).length > Net.roster.filter(r => r.team === 1).length ? 1 : 0 });
        Net.send(peer, { t: 'you', id: peer.id }); Net.lobby(); Snd.ui('buy'); return;
    }
    if (!peer.id) return; const seat = Net.state === 'game' ? G.roster.find(x => x.id === peer.id) : null, r = seat && !seat.held ? seat : null, e = Net.roster.find(x => x.id === peer.id);          // held: a bot still has the seat while the newcomer loads
    if (m.t === 'team') { if (e && Net.state === 'lobby') { e.team = m.team ? 1 : 0; e.ready = false; Net.lobby(); } return; }
    if (m.t === 'ready') { if (e && Net.state === 'lobby') { e.ready = !e.ready; Net.lobby(); } return; }
    if (m.t === 'chat') { if (e) Net.say(e.name, m.s); return; }
    if (m.t === 'veh') { if (r && VEHS[m.veh]) { r.veh = m.veh; if (e) e.veh = m.veh; Net.all({ t: 'veh', id: peer.id, veh: m.veh }, false, peer.id); } return; }
    if (m.t === 'in') { if (seat && seat.held) Net.seated(seat); return; }
    if (m.t === 'kit') { const e = Net.roster.find(x => x.id === peer.id); if (e && VEHS[m.veh]) { e.veh = m.veh; Net.lobby(); } }
    else if (m.t === 'S') { if (r && r.U && m.life === r.life && !r.U.dead) Net.aim(r.U, m.s); if (m.f) for (const f of m.f) { Net.shell(peer.id, f); Net.out.push([peer.id].concat(f)); } }
    else if (m.t === 'hit') { if (!r || !r.U) return; const v = G.roster.find(x => x.id === m.to); if (!v || !v.U || v.U.dead) return; if (m.to === peer.id) Units.damage(v.U, 1e6, null, G, 'CRASHED'); else if (G.ff || v.U.team !== r.U.team) Units.damage(v.U, Math.min(3000, +m.dmg || 0), r.U, G, String(m.word || 'HIT').slice(0, 12)); }
    else if (m.t === 'bye') Net.hostLost(peer);
};
// ---- a guest hears the host
Net.guestMsg = function (m) {
    const G = Game;
    if (m.t === 'you') { Net.me.id = m.id; Net.state = 'lobby'; UI.tab = 'mp'; UI.page(); }
    else if (m.t === 'no') Net.fail(m.why);
    else if (m.t === 'lobby') { Net.cfg = m.cfg; Net.roster = m.roster; if (Net.state !== 'game') { Net.state = 'lobby'; Net.redraw(); } }
    else if (m.t === 'start') { Net.cfg = m.cfg; Net.late = !!m.late; Net.begin(m.roster); }
    else if (m.t === 'chat') Net.heard(m.n, m.s);
    else if (m.t === 'seat') { for (const L of [Net.full || [], G.roster || []]) { const s = L.find(x => x.id === m.from); if (s) { s.id = m.to; s.name = m.name; s.veh = m.veh; } } if (App.game === G && G.net) HUD.feed(esc(m.name) + ' is joining'); }
    else if (m.t === 'veh') { for (const L of [Net.full || [], G.roster || []]) { const s = L.find(x => x.id === m.id); if (s && VEHS[m.veh]) s.veh = m.veh; } }
    else if (m.t === 'bye') Net.hostGone();
    else if (Net.state !== 'game' || App.game !== G || !G.net) return;
    else if (m.t === 'P') Net.snapshot(m);
    else if (m.t === 'kf') { const k = G.roster.find(x => x.id === m.k), v = G.roster.find(x => x.id === m.v); if (v) HUD.feed('<span class="t' + (k ? Math.min(1, k.team) : 1) + '">' + esc(k ? k.name : '?') + '</span> &#10005; <span class="t' + Math.min(1, v.team) + '">' + esc(v.name) + '</span>'); if (k && k.me && v && !v.me) { G.kills++; HUD.hit(true); HUD.callout('DESTROYED  +100'); Snd.tone(440, 0.2, 0.5, 'triangle', 880); Save.data.stats.kills++; } if (v && v.me) { G.deaths++; HUD.banner('KNOCKED OUT', Game.lineup().length > 1 ? 'number keys: pick what you come back in' : 'a new tank is on its way'); } }
    else if (m.t === 'ban') HUD.banner(m.a, m.b);
    else if (m.t === 'end') { const w = m.id !== undefined ? (m.id === Net.me.id ? 0 : 1) : m.win < 0 ? -1 : Net.lt(m.win); Game.endTeams(w); }
};

// ---- the battle
Net.startMatch = function () {
    if (!Net.host || Net.state !== 'lobby') return; const c = Net.cfg, size = clamp(c.size | 0 || 4, 2, 6), tier = (VEHS[Save.data.veh] || VEHS.mt1).tier, airs = Object.keys(AIRS).filter(a => Units.extra[a]);
    const pick = () => { const b = airs.length && Math.random() < 0.15 ? airs[(Math.random() * airs.length) | 0] : ['lt', 'mt', 'mt', 'ht', 'td', 'spaa'][(Math.random() * 6) | 0]; return b + clamp(tier + ((Math.random() * 3) | 0) - 1, 1, MAX_TIER); };
    const full = Net.roster.map(r => ({ id: r.id, name: r.name, veh: r.veh, team: r.team })), names = CALLSIGNS.slice().sort(() => Math.random() - 0.5); let b = 0;
    for (let t = 0; t < 2; t++) while (full.filter(r => r.team === t).length < size) full.push({ id: 'b' + b++, name: names.pop() || 'Crew', veh: pick(), team: t, bot: true });
    Net.late = false; for (const r of Net.roster) r.ready = r.id === 'H'; Net.all({ t: 'start', cfg: c, roster: full }); Net.begin(full);
};
Net.begin = async function (full) {
    Net.state = 'game'; Net.out = []; Net.sendT = 0; Net.life = 0; Net.full = full; const mine = full.find(r => r.id === Net.me.id) || full[0]; Net.myTeam = mine.team; if (MAPS[Net.cfg.map]) { UI.map = Net.cfg.map; UI.picked = true; }
    const ok = await UI.play({ mode: Net.cfg.mode, veh: mine.veh, size: Net.cfg.size, skill: Net.cfg.skill, wx: Net.cfg.wx, len: Net.cfg.len, ff: Net.cfg.ff, net: { host: Net.host, me: Net.me.id, roster: full } });
    if (!ok) Net.leave(); else if (Net.late && !Net.host && Net.peers.H) Net.send(Net.peers.H, { t: 'in' });          // a latecomer has the ground loaded: the host hands over the seat
};
// the roster of a battle as this computer keeps it: itself first, sides turned so that its own is 0
Net.rows = function (full) {
    const me = Net.me.id, L = full.slice().sort((a, b) => (b.id === me) - (a.id === me));
    return L.map(r => ({ id: r.id, name: r.id === me ? 'You' : r.name, team: Net.lt(r.team), veh: r.veh, me: r.id === me, bot: !!r.bot && Net.host, remote: r.id !== me && !(r.bot && Net.host), kills: 0, deaths: 0, score: 0, back: 0, U: null, life: 0 }));
};
// where and how a vehicle that someone else drives was last said to be: [x, y, z, yaw, turret, gun, pitch, roll, speed]
Net.aim = function (U, s) { U.tx = s[0]; U.ty = s[1]; U.tz = s[2]; U.tyw = s[3]; U.ttu = s[4]; U.tel = s[5]; U.tpi = s[6]; U.tro = s[7]; U.v = s[8]; };
Net.pack = U => [Math.round(U.x * 10) / 10, Math.round(U.y * 10) / 10, Math.round(U.z * 10) / 10, Math.round(U.yaw * 100) / 100, Math.round(U.tyaw * 100) / 100, Math.round(U.elev * 100) / 100, Math.round((U.pitch || 0) * 100) / 100, Math.round((U.roll || 0) * 100) / 100, Math.round(U.v * 10) / 10];
// a shell someone else fired: drawn, harmless here
Net.shell = function (by, f) { const r = Game.roster.find(x => x.id === by); if (!r || !r.U) return; Units.shells.push({ x: f[1], y: f[2], z: f[3], vx: f[4], vy: f[5], vz: f[6], t: 0, by: r.U, type: SHELLS[f[0]] ? f[0] : 'ap', k: 1, cos: true }); const small = SHELLS[f[0]] && SHELLS[f[0]].small; if (small) World.fire.add(f[1], f[2], f[3], 0, 0.5, 0, 0.9, 3, 0.08, 1, 0.9, 0.6, 1); else World.boom(f[1], f[2] - 0.5, f[3], false); Game.heard(f[1], f[3], small ? 0.25 : 0.7, small ? 420 : 220, small ? 0.1 : 0.5); r.U.recoil = small ? 0.35 : 1; };
// a vehicle of this computer fired: everyone else is told
Net.fired = function (U, s) { if (!Game.net || U.remote || s.cos || !U.who) return; if (!Net.host && U !== Game.P) return; Net.out.push([U.who.id, s.type, Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10, Math.round(s.z * 10) / 10, Math.round(s.vx), Math.round(s.vy), Math.round(s.vz)]); };
// a guest's shell hit something (or it flew into the ground): the host decides what that does
Net.guestDamage = function (U, dmg, by, word) {
    const G = Game, P = G.P; if (U === P && !by) { Net.send(Net.peers.H, { t: 'hit', to: Net.me.id, dmg: 1e6, word: 'CRASHED' }); return; }
    if (by !== P || !U.who || U.dead) return; Net.send(Net.peers.H, { t: 'hit', to: U.who.id, dmg: Math.round(dmg), word }); U.hitT = 0.3; U.rock = Math.max(U.rock, 0.6); G.struck(U, dmg, by, word);
};
Net.killLocal = function (U) { if (U.dead) return; U.hp = 0; U.dead = true; U.deadT = 0; World.boom(U.x, U.y + 1.5, U.z, true); World.boom(U.x, U.y + 2.2, U.z, true); Game.heard(U.x, U.z, 1, 70, 1.2); };
// once a frame for everyone: the vehicles others drive glide to where they were last said to be; 15 times a second, say where ours is
Net.step = function (dt) {
    const G = Game, P = G.P; if (!Net.on || Net.state !== 'game' || !G.net) return; const f = Math.min(1, dt * 10);
    for (const U of Units.list) { if (!U.remote || U.dead || U.tx === undefined) continue; U.x = lerp(U.x, U.tx, f); U.z = lerp(U.z, U.tz, f); U.yaw += wrapA(U.tyw - U.yaw) * f; U.tyaw += wrapA(U.ttu - U.tyaw) * f; U.elev = lerp(U.elev, U.tel, f);
        if (U.air) { U.y = lerp(U.y, U.ty, f); U.pitch = lerp(U.pitch, U.tpi, f); U.roll = lerp(U.roll, U.tro, f); } else { const v = U.v; U.v = 0; Units.drive(U, 0, 0, dt); U.v = v; } }
    Net.sendT -= dt; if (Net.sendT > 0) return; Net.sendT = 1 / 15;
    if (!Net.host) { Net.send(Net.peers.H, { t: 'S', life: Net.life, s: Net.pack(P), f: Net.out.length ? Net.out.map(o => o.slice(1)) : undefined }, true); Net.out = []; return; }
    const m = { t: 'P', u: G.roster.filter(r => r.U).map(r => [r.id, r.life, r.U.dead ? 0 : 1, Math.round(r.U.hp)].concat(Net.pack(r.U))), r: G.roster.map(r => [r.id, r.kills, r.deaths, Math.round(r.score), G.score2[r.team] || 0]), g: [Math.round(G.matchT), Math.round(G.tickets[0]), Math.round(G.tickets[1])] };
    if (G.points.length) m.p = G.points.map(p => [Math.round(p.v * 100) / 100, p.own]); if (G.flags) m.fl = G.flags.map(F => [F.st, Math.round(F.x), Math.round(F.z), F.by && F.by.who ? F.by.who.id : '']);
    if (Net.out.length) { m.f = Net.out; Net.out = []; } Net.all(m, true);
};
// a guest takes the host's picture of the battle
Net.snapshot = function (m) {
    const G = Game, sw = Net.myTeam === 1;
    for (const s of m.u) { const r = G.roster.find(x => x.id === s[0]); if (!r) continue; const life = s[1], alive = !!s[2], hp = s[3], st = s.slice(4);
        if (r.me) { if (life > Net.life && alive) { Net.life = life; const old = r.U; const U = Units.make(0, st[0], st[2], st[3], r.veh, G.mods); U.who = r; U.reload = 1; if (U.air) U.y = st[1]; r.U = G.P = U; G.aimYaw = st[3]; G.aimPitch = -0.04; if (old && old !== U && Units.list.indexOf(old) >= 0) Units.retire(old); HUD.set('msg', ''); }
            else if (r.U && life === Net.life) { if (alive) r.U.hp = Math.min(r.U.max, hp); else Net.killLocal(r.U); } continue; }
        let U = r.U; if (!U || r.life !== life) { if (!alive) continue; U = r.U = Units.make(r.team, st[0], st[2], st[3], r.veh); U.who = r; U.remote = true; r.life = life; if (U.air) U.y = st[1]; }
        Net.aim(U, st); U.hp = hp; if (!alive) Net.killLocal(U); }
    for (const s of m.r) { const r = G.roster.find(x => x.id === s[0]); if (r) { r.kills = s[1]; r.deaths = s[2]; r.score = s[3]; G.score2[r.team] = s[4]; } }
    G.matchT = m.g[0]; G.tickets[0] = m.g[sw ? 2 : 1]; G.tickets[1] = m.g[sw ? 1 : 2];
    if (m.p) m.p.forEach((p, i) => { const q = G.points[i]; if (!q) return; q.v = sw ? -p[0] : p[0]; q.own = p[1] < 0 ? -1 : Net.lt(p[1]); q.beam.c = q.own === 0 ? [0.5, 1, 0.45] : q.own === 1 ? [1.3, 0.45, 0.3] : [1, 1, 1]; q.beam.k = 0.55 + Math.abs(q.v) * 0.45; });
    if (m.fl && G.flags) m.fl.forEach((f, i) => { const F = G.flags[Net.lt(i)]; if (!F) return; const c = G.roster.find(x => x.id === f[3]); F.st = f[0]; F.x = f[1]; F.z = f[2]; F.by = c ? c.U : null; const Bm = F.beam, t = Net.lt(i); Bm.x = F.x; Bm.z = F.z; Bm.y = World.height(F.x, F.z); Bm.c = F.st === 2 ? [1, 1, 1] : t ? [1.3, 0.45, 0.3] : [0.5, 1, 0.45]; Bm.k = F.st === 1 ? 1 : 0.6; });
    if (m.f) for (const f of m.f) if (f[0] !== Net.me.id) Net.shell(f[0], f.slice(1));
};

// ---- joining a battle that is already running: the newcomer takes a bot's seat (its own old seat, if it dropped out of this battle)
Net.lateJoin = function (peer, id, name, veh) {
    const G = Game, no = why => Net.send(peer, { t: 'no', why }), humans = t => G.roster.filter(r => r.team === t && !r.bot).length;
    if (!App.game || !G.net || G.over) return no('That party is between battles. Try again in a moment.'); if (G.mode === 'ffa') return no('That party is in a free-for-all. Try again when it ends.');
    const seats = G.roster.filter(r => r.bot && !r.me && !r.held), seat = seats.find(r => r.name === name) || seats.sort((a, b) => humans(a.team) - humans(b.team))[0]; if (!seat) return no('That battle is full.');
    const from = seat.id; peer.id = id; peer.pending = false; Net.peers[id] = peer; seat.id = id; seat.name = name; seat.veh = veh; seat.held = true;
    Net.roster.push({ id, name, veh, ready: false, team: Net.lt(seat.team) }); Net.all({ t: 'seat', from, to: id, name, veh }, false, id);
    Net.send(peer, { t: 'you', id }); Net.send(peer, { t: 'start', cfg: Net.cfg, late: true, roster: G.roster.map(r => ({ id: r.id, name: r.me ? Net.me.name : r.name, veh: r.veh, team: Net.lt(r.team), bot: !!r.bot && !r.held })) });
    HUD.feed(esc(name) + ' is joining');
};
// the newcomer is in: the bot's vehicle goes, and the seat comes back as theirs
Net.seated = function (s) { s.held = false; s.bot = false; s.remote = true; const old = s.U; if (old && !old.dead) { old.dead = true; old.hp = 0; old.deadT = 0; old.counted = true; } s.back = 0.6; HUD.banner(s.name.toUpperCase() + ' JOINED', 'in place of a bot'); Net.all({ t: 'ban', a: s.name.toUpperCase() + ' JOINED', b: 'in place of a bot' }, false, s.id); };
// what this computer's player will come back in
Net.veh = function (id) { if (!Net.on || Net.state !== 'game') return; const e = Net.roster.find(x => x.id === Net.me.id); if (e) e.veh = id; if (Net.host) Net.all({ t: 'veh', id: Net.me.id, veh: id }); else if (Net.peers.H) Net.send(Net.peers.H, { t: 'veh', veh: id }); };
// chat: the host passes every line on
Net.heard = function (n, s) { s = String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120); n = String(n || '').slice(0, 14); if (!s) return ''; Net.chat.push([n, s]); if (Net.chat.length > 40) Net.chat.shift(); if (App.game) HUD.feed('<b>' + esc(n) + ':</b> ' + esc(s)); else Net.redraw(); return s; };
Net.say = function (n, s) { s = Net.heard(n, s); if (s && Net.host) Net.all({ t: 'chat', n, s }); };
Net.sayMine = function () { const i = document.querySelector('[data-netin=chat]'), s = i ? i.value : ''; if (i) i.value = ''; if (!s.trim() || !Net.on) return; if (Net.host) Net.say(Net.me.name, s); else if (Net.peers.H) Net.send(Net.peers.H, { t: 'chat', s: s.slice(0, 120) }); };
// ---- the party page
Net.pageHTML = function () {
    const c = Net.cfg, host = Net.host;
    if (!Net.on || Net.state === 'idle') return '<div class="sheet"><div class="h3">Your name</div><div class="row"><input type="text" data-netin="name" maxlength="14" value="' + esc(Save.data.name || '') + '" placeholder="Commander" style="width:220px"></div><div class="h3" style="margin-top:16px">Start a party</div><p>You get a 6-digit code. Friends type it in and you fight on the same field: no account needed. Bots fill the empty places on both sides.</p><button class="btn go" data-net="host">HOST A PARTY</button>' +
        '<div class="h3" style="margin-top:20px">Join a party</div><div class="row"><input type="text" data-netin="code" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="width:160px;font-size:22px;letter-spacing:.2em"><button class="btn go" data-net="join">JOIN</button></div>' + (Net.err ? '<p style="color:var(--bad)">' + esc(Net.err) + '</p>' : '') + '</div>';
    if (Net.state === 'opening' || Net.state === 'joining') return '<div class="sheet"><p style="letter-spacing:.2em;animation:pulse 1.2s infinite">' + (Net.state === 'opening' ? 'OPENING A PARTY...' : 'LOOKING FOR PARTY ' + esc(Net.code) + '...') + '</p><button class="btn" data-net="leave">CANCEL</button></div>';
    const maps = World.maps(), dis = host ? '' : ' disabled', mine = Net.roster.find(r => r.id === Net.me.id) || {}, wait = Net.roster.filter(r => r.id !== 'H' && !r.ready).length;
    const side = t => Net.roster.filter(r => r.team === t).map(r => '<div class="row"><label><i class="rdy' + (r.id === 'H' || r.ready ? '">&#10003;' : ' no">&middot;') + '</i> ' + esc(r.name) + (r.id === 'H' ? ' <small style="display:inline;color:var(--ember2)">HOST</small>' : '') + (r.id === Net.me.id ? ' <small style="display:inline">you</small>' : '') + '</label><small>' + (VEHS[r.veh] ? VEHS[r.veh].name : '') + (host && r.id !== 'H' ? ' <button class="mini" data-net="move" data-v="' + r.id + '" title="Move to the other side">&#8644;</button><button class="mini" data-net="kick" data-v="' + r.id + '" title="Remove from the party">&#10005;</button>' : '') + '</small></div>').join('') || '<div class="row"><label style="color:var(--dim)">bots</label></div>';
    const head = (t, name, col) => '<div class="h3" style="color:' + col + '">' + name + (mine.team !== t ? ' <button class="mini" data-net="team" data-v="' + t + '">JOIN</button>' : '') + '</div>';
    const chat = '<div class="h3" style="margin-top:12px">Chat</div><div id="net-chat" class="chat">' + (Net.chat.map(l => '<div><b>' + esc(l[0]) + '</b> ' + esc(l[1]) + '</div>').join('') || '<div style="color:var(--dim)">Nothing said yet.</div>') + '</div><div class="row" style="border:0"><input type="text" data-netin="chat" maxlength="120" placeholder="Say something, then Enter" style="flex:1"><button class="btn" data-net="say">SEND</button></div>';
    return '<div class="sheet"><div class="h3">Party code</div><div class="code">' + esc(Net.code) + '</div><p>Friends: MULTIPLAYER, type this code, JOIN. A battle that is already running can be joined too: the newcomer takes over a bot.</p><div class="pair"><div style="flex:1">' + head(0, 'Olive', '#b9e08a') + side(0) + '</div><div style="flex:1">' + head(1, 'Sand', '#ffb09a') + side(1) + '</div></div>' + (c.mode === 'ffa' ? '<p>Free-for-all: the sides do not matter.</p>' : '') +
        '<div class="row" style="border:0">' + (host ? '<span><button class="btn" data-net="shuffle">SHUFFLE</button> <button class="btn" data-net="balance">BALANCE</button></span>' : '<button class="btn' + (mine.ready ? ' go' : '') + '" data-net="ready">' + (mine.ready ? 'READY &#10003;' : 'I AM READY') + '</button>') + '</div>' + chat + '</div>' +
        '<div class="sheet right"><div class="h3">The battle' + (host ? '' : ' (the host chooses)') + '</div><div class="seg">' + ['tdm', 'conq', 'ctf', 'ffa'].map(id => '<button data-net="mode" data-v="' + id + '" class="' + (c.mode === id ? 'on' : '') + '"' + dis + '>' + MODES[id].name + '</button>').join('') + '</div><p>' + esc(MODES[c.mode].blurb) + '</p>' +
        '<div class="h3">The ground</div><div class="seg">' + (maps.length ? maps : [UI.map]).map(id => '<button data-net="map" data-v="' + id + '" class="' + ((c.map || UI.map) === id ? 'on' : '') + '"' + dis + '>' + MAPS[id].name + '</button>').join('') + '</div>' +
        '<div class="pair"><div><div class="h3">Tanks a side</div><div class="seg">' + [3, 4, 5, 6].map(n => '<button data-net="size" data-v="' + n + '" class="' + (c.size === n ? 'on' : '') + '"' + dis + '>' + n + '</button>').join('') + '</div></div><div><div class="h3">The bots</div><div class="seg">' + Object.keys(BOT_SKILL).map(id => '<button data-net="skill" data-v="' + id + '" class="' + (c.skill === id ? 'on' : '') + '"' + dis + '>' + BOT_SKILL[id].name + '</button>').join('') + '</div></div></div>' +
        '<div class="h3">The weather</div><div class="seg">' + Object.keys(WEATHER).map(id => '<button data-net="wx" data-v="' + id + '" class="' + ((c.wx || 'clear') === id ? 'on' : '') + '"' + dis + '>' + WEATHER[id].name + '</button>').join('') + '</div>' +
        '<div class="pair"><div><div class="h3">How long</div><div class="seg">' + Object.keys(LENGTHS).map(id => '<button data-net="len" data-v="' + id + '" class="' + ((c.len || 'normal') === id ? 'on' : '') + '"' + dis + '>' + LENGTHS[id].name + '</button>').join('') + '</div></div><div><div class="h3">Friendly fire</div><div class="seg"><button data-net="ff" data-v="0" class="' + (c.ff ? '' : 'on') + '"' + dis + '>OFF</button><button data-net="ff" data-v="1" class="' + (c.ff ? 'on' : '') + '"' + dis + '>ON</button></div></div></div>' +
        '<div class="roll"><button class="btn" data-net="leave">LEAVE</button>' + (host ? '<button class="btn go" data-net="start">START THE BATTLE' + (wait ? ' (' + wait + ' NOT READY)' : '') + '</button>' : '<span>' + (mine.ready ? 'WAITING FOR THE HOST' : 'SAY WHEN YOU ARE READY') + '</span>') + '</div></div>';
};
Net.click = function (d) {
    const a = d.net, c = Net.cfg; Snd.ui('click');
    if (a === 'host') Net.hostGame(); else if (a === 'join') { const i = document.querySelector('[data-netin=code]'); Net.join(i ? i.value : ''); } else if (a === 'leave') { Net.leave(); setTimeout(() => UI.page(), 80); }
    else if (a === 'start') Net.startMatch();
    else if (a === 'say') Net.sayMine();
    else if (a === 'team') { const t = +d.v ? 1 : 0; if (Net.host) { Net.roster[0].team = t; Net.lobby(); } else if (Net.peers.H) Net.send(Net.peers.H, { t: 'team', team: t }); }
    else if (a === 'ready') { if (!Net.host && Net.peers.H) Net.send(Net.peers.H, { t: 'ready' }); }
    else if (Net.host && (a === 'move' || a === 'kick' || a === 'shuffle' || a === 'balance')) {
        const L = Net.roster, e = L.find(x => x.id === d.v && x.id !== 'H'), cnt = t => L.filter(x => x.team === t).length;
        if (a === 'move') { if (e) { e.team = 1 - e.team; e.ready = false; } }
        else if (a === 'kick') { const p = e && Net.peers[e.id]; if (p) { Net.send(p, { t: 'no', why: 'The host removed you from the party.' }); setTimeout(() => { try { p.conn.close(); } catch (x) { } Net.hostLost(p); }, 250); } return; }
        else if (a === 'shuffle') L.slice().sort(() => Math.random() - 0.5).forEach((x, i) => { x.team = i % 2; });
        else for (let k = 0; k < 8 && Math.abs(cnt(0) - cnt(1)) > 1; k++) { const big = cnt(0) > cnt(1) ? 0 : 1, x = L.filter(y => y.team === big && y.id !== 'H').pop(); if (!x) break; x.team = 1 - big; }
        Net.lobby();
    }
    else if (Net.host) { if (a === 'mode') c.mode = d.v; else if (a === 'map') c.map = d.v; else if (a === 'size') c.size = +d.v; else if (a === 'skill') c.skill = d.v; else if (a === 'wx') c.wx = d.v; else if (a === 'len') c.len = d.v; else if (a === 'ff') c.ff = d.v === '1'; Net.lobby(); }
};
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button[data-net]'); if (b && !b.disabled) Net.click(b.dataset); });
document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.netin === 'name') { Save.data.name = t.value.slice(0, 14); Save.store(); } });
document.addEventListener('keydown', e => { const t = e.target; if (e.key === 'Enter' && t && t.dataset && t.dataset.netin === 'chat') { e.preventDefault(); Net.sayMine(); } });
