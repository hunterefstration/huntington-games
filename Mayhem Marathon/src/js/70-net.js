// ============================================================
// MULTIPLAYER (HGNet). The host runs the show: round picks, obstacles clock, bots, grabs/pushes,
// qualify/eliminate. Guests simulate only their own Tumbler and send it ~15 times a second; the host
// streams everyone at 15 Hz ('fast' = newest wins) and sends decisions as reliable events.
// ============================================================
const GAME_ID = 'mayhem', MAXP = 16;
const NET = { net: null, host: false, code: '', myId: 0, roster: [], status: '', bad: false, busy: false, inShow: false, info: {}, sendT: 0, lpOpen: '' };
function hgLoad() {
    let h = window.HGNet; try { if (!h && LP()) h = window.parent.HGNet; } catch (e) {}
    if (h) return Promise.resolve(h);
    return new Promise(res => { const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js'; s.onload = () => res(window.HGNet || null); s.onerror = () => res(null); document.head.appendChild(s); });
}
function netSendAll(msg, fast) { if (G.host && NET.net) NET.net.send('all', msg, fast ? { fast: true } : undefined); }
function netSendHost(msg, fast) { if (!G.host && NET.net) NET.net.send('host', msg, fast ? { fast: true } : undefined); }
function netEvent(e) { if (G.host && NET.net) NET.net.send('all', { t: 'ev', e }); }
function netStatus(t, bad) { NET.status = t; NET.bad = !!bad; UI.paintLobby(); }
function rememberRoom(code) { try { localStorage.setItem('mayhem_last', JSON.stringify({ code, at: Date.now() })); } catch (e) {} }
function lastRoom() { try { const o = JSON.parse(localStorage.getItem('mayhem_last') || 'null'); if (o && Date.now() - o.at < 15 * 60000 && /^\d{6}$/.test(o.code)) return o.code; } catch (e) {} return ''; }
function hostRoster() {
    const out = [{ id: 0, name: myName(), look: save.look, ready: true }];
    if (NET.net) for (const p of NET.net.peers()) if (!p.isHost && p.state !== 'left') { const i = NET.info[p.id] || {}; out.push({ id: p.id, name: String(p.name || 'Player').slice(0, 16), look: sanitizeLook(i.look || (p.info && p.info.look)), ready: !!i.ready, lag: p.state !== 'connected' }); }
    return out.slice(0, MAXP);
}
function broadcastLobby() {
    if (!NET.host || !NET.net) return;
    NET.roster = hostRoster();
    NET.net.send('all', { t: 'lobby', r: NET.roster, opts: save.opts, inShow: NET.inShow });
    UI.paintLobby(); advertise();
}
function wireNet(net) {
    net.on('status', t => { if (!NET.code) netStatus(t); });
    net.on('join', peer => { if (!NET.host) return; NET.info[peer.id] = Object.assign(NET.info[peer.id] || {}, { look: peer.info && peer.info.look }); broadcastLobby(); if (NET.inShow) sendSync(peer.id); });
    net.on('reconnected', (peer, o) => { if (NET.host && o && o.rejoin && NET.inShow) sendSync(peer.id); });
    net.on('leave', peer => {
        if (!NET.host) return;
        delete NET.info[peer.id]; broadcastLobby();
        const C = byId(peer.id), R = G.R;
        if (C && R && C.inRound && !C.done && !C.hide && !C.bot) {     // keep the race fair and fun: a bot takes over
            C.bot = true; C.wasHuman = true; C.skill = 1; C.sim = true; const v = C.vs; C.b = mkBody(v.x, v.y, v.z, v.yaw); botNew(C); toast(C.name + ' dropped out - a bot takes over');
        }
    });
    net.on('message', (peer, m) => { try { onNetMsg(peer, m); } catch (e) { console.error(e); } });
    net.on('closed', (reason, text) => {
        const was = !!G.show; netReset();
        toast(reason === 'host-left' ? 'The host left the room.' : (text || 'Left the room.'));
        if (was || G.screen === 'lobby') UI.toTitle();
    });
}
function onNetMsg(peer, m) {
    if (!m || typeof m !== 'object') return;
    if (NET.host) return onHostMsg(peer, m);
    switch (m.t) {
        case 'lobby': NET.roster = m.r; if (m.opts) Object.assign(NET.hostOpts = {}, m.opts); NET.inShow = m.inShow; UI.paintLobby(); break;
        case 'show': G.host = false; beginShow(m); break;
        case 'round': if (G.show) { G.show.idx = m.idx; beginRound(m); } break;
        case 's': applySnapshot(m); break;
        case 'ev': applyEvent(m.e); break;
        case 'rend': applyRoundEnd(m); break;
        case 'win': applyWin(m); break;
        case 'tolobby': G.show = null; G.R = null; NET.inShow = false; UI.showLobby(); break;
        case 'sync': applySync(m); break;
    }
}
function onHostMsg(peer, m) {
    const C = byId(peer.id), R = G.R;
    switch (m.t) {
        case 'hi': NET.info[peer.id] = { look: sanitizeLook(m.look), ready: !!m.ready }; broadcastLobby(); break;
        case 'p': {
            if (!C || C.sim || !R || !Array.isArray(m.a)) return; const a = m.a;
            C.buf.push({ t: +m.rt, x: a[0] / 100, y: a[1] / 100, z: a[2] / 100, yaw: a[3] / 100, f: a[4] | 0, gt: a[5] | 0 }); if (C.buf.length > 40) C.buf.shift();
            break;
        }
        case 'fin': if (C && R && !C.sim && C.vs.z > L.finZ - 6) hostQualify(C); break;
        case 'fell': if (C && R && survivalLike(R)) hostOut(C); break;
        case 'crown': if (C && R && R.crownPos && Math.hypot(C.vs.x - R.crownPos.x, C.vs.z - R.crownPos.z) < 5) hostCrown(C); break;
    }
}
function hostSnapshot(R) {
    if (!NET.net) return;
    const p = [];
    for (const C of R.cs) { if (C.hide) continue; const v = C.vs; p.push([C.id, Math.round(v.x * 100), Math.round(v.y * 100), Math.round(v.z * 100), Math.round(v.yaw * 100), (v.st & 7) | (v.ground ? 8 : 0) | (v.grab ? 16 : 0)]); }
    const msg = { t: 's', rt: +R.t.toFixed(3), p }; if (R.def.snap) msg.ex = R.def.snap(R);
    NET.net.send('all', msg, { fast: true });
}
function applySnapshot(m) {
    const R = G.R; if (!R || !Array.isArray(m.p)) return;
    const target = m.rt + 0.05, d = target - R.t;
    if (Math.abs(d) > 0.75) { R.t = target; G.rtBias = 0; } else G.rtBias = d;
    for (const e of m.p) {
        if (e[0] === G.me) continue; const C = byId(e[0]); if (!C || C.sim) continue;
        C.buf.push({ t: m.rt, x: e[1] / 100, y: e[2] / 100, z: e[3] / 100, yaw: e[4] / 100, f: e[5] }); if (C.buf.length > 40) C.buf.shift();
    }
    if (m.ex && R.def.unsnap) R.def.unsnap(R, m.ex);
}
function clientTick(R, dt) {
    NET.sendT += dt;
    const me = byId(G.me);
    if (NET.sendT >= 1 / 15 && me && me.inRound && !me.hide && me.b) {
        NET.sendT = 0; const b = me.b, v = me.vs;
        netSendHost({ t: 'p', rt: +R.t.toFixed(3), a: [Math.round(b.p.x * 100), Math.round(b.p.y * 100), Math.round(b.p.z * 100), Math.round(b.yaw * 100), (b.st & 7) | (b.ground ? 8 : 0) | (v.grab ? 16 : 0), b.ground && b.gc ? b.gc.id : -1] }, true);
    }
    if (R.phase === 'over' && R.overT > 2.6 && !R.resultsShown) { R.resultsShown = true; UI.showResults(R); }
}
// late joiners and rejoiners get the whole picture
function sendSync(id) {
    const S = G.show, R = G.R; if (!S || !NET.net) return;
    const msg = { t: 'sync', show: { seed: S.seed, len: S.len, pts: S.pts, cs: S.cs.map(c => ({ id: c.id, name: c.name, look: c.look, bot: c.bot && !c.wasHuman, skill: c.skill, out: c.out, points: c.points })), idx: S.idx, used: S.used } };
    const C = byId(id);
    if (C && C.wasHuman) { C.bot = false; C.wasHuman = false; C.sim = false; C.ai = null; C.buf = []; }
    if (R && S.lastRound && !R.ended) {
        msg.round = S.lastRound; msg.rt = R.t;
        msg.done = R.cs.filter(c => c.done).map(c => [c.id, c.done]); msg.fin = R.finished; msg.outs = R.outs;
        msg.tiles = L.tiles.filter(c => c.ts).map(c => [c.id, c.dropAt]); msg.tails = [...R.tails]; msg.hoops = R.hoops; msg.score = R.score; msg.crownBy = R.crownBy;
        if (C && C.inRound) msg.me = [C.vs.x, C.vs.y, C.vs.z];
    }
    NET.net.send(id, msg);
}
function applySync(m) {
    G.host = false;
    beginShow({ seed: m.show.seed, len: m.show.len, pts: m.show.pts, cs: m.show.cs });
    for (const c of m.show.cs) { const C = byId(c.id); if (C) { C.out = c.out; C.points = c.points; } }
    if (!byId(G.me)) toast('A show is running - you are spectating until the next one.');
    G.show.idx = m.show.idx; G.show.used = m.show.used || [];
    if (!m.round) { UI.spectateWait(); return; }
    beginRound(m.round); const R = G.R; R.t = m.rt;
    for (const [id, how] of m.done || []) { const C = byId(id); if (C && !C.done) { C.done = how; if (how === 'out' || R.info.kind === 'race') C.hide = true; } }
    R.finished = m.fin || []; R.outs = m.outs || [];
    for (const [i, at] of m.tiles || []) { const c = W.cs[i]; if (c) { c.ts = 1; c.dropAt = at; if (R.t > at) c.on = false; setColColor(c, 0xff4f6d); } }
    R.tails = new Set(m.tails || []); R.hoops = m.hoops || []; R.score = m.score || []; R.crownBy = m.crownBy;
    const me = byId(G.me);
    if (me && me.inRound && m.me && me.b) { me.b.p.x = m.me[0]; me.b.p.y = m.me[1] + 0.3; me.b.p.z = m.me[2]; }
    if (me && me.done) G.spec = nextSpec(null);
    UI.hideIntro();
}
function netReset() {
    try { NET.net && NET.net.close(); } catch (e) {}
    if (NET.lpOpen) { try { const p = LP(); p && p.HG_partyClose && p.HG_partyClose(NET.lpOpen); } catch (e) {} NET.lpOpen = ''; }
    Object.assign(NET, { net: null, host: false, code: '', myId: 0, roster: [], status: '', bad: false, busy: false, inShow: false, info: {} });
    G.host = true; G.me = 0;
}
function netHost() {
    if (NET.net || NET.busy) return; NET.busy = true; netStatus('Opening a room...');
    hgLoad().then(HG => {
        if (!HG) { NET.busy = false; return netStatus('Online play needs the Huntington Games launcher (or a connection to the game servers).', true); }
        const net = HG.create({ game: GAME_ID }); NET.net = net; wireNet(net);
        net.host({ name: myName(), maxPlayers: MAXP, info: { look: save.look }, accept: () => hostRoster().length >= MAXP ? 'The room is full.' : true }).then(r => {
            NET.host = true; G.host = true; G.me = 0; NET.code = r.code; NET.busy = false; rememberRoom(r.code); netStatus('Room open - share the code!'); broadcastLobby();
        }, e => { NET.busy = false; netReset(); netStatus(e.message || 'Could not open a room.', true); });
    });
}
function netJoin(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return netStatus('Type the 6-digit code.', true);
    if (NET.net || NET.busy) return; NET.busy = true; netStatus('Joining ' + code + '...');
    hgLoad().then(HG => {
        if (!HG) { NET.busy = false; return netStatus('Online play needs the Huntington Games launcher (or a connection to the game servers).', true); }
        const net = HG.create({ game: GAME_ID }); NET.net = net; wireNet(net);
        net.join(code, { name: myName(), info: { look: save.look } }).then(r => {
            NET.host = false; G.host = false; NET.code = r.code || code; NET.myId = G.me = r.id; NET.busy = false; rememberRoom(NET.code);
            netStatus('In the room. Waiting for the host to start.'); sendHi(); UI.paintLobby();
        }, e => { NET.busy = false; netReset(); netStatus(e.message || 'Could not join.', true); });
    });
}
function sendHi() { if (NET.net && !NET.host) NET.net.send('host', { t: 'hi', look: save.look, ready: !!NET.ready }); }
function netLeave() { netReset(); }
function netStartShow() {
    if (!NET.host) return;
    const humans = hostRoster().map(h => ({ id: h.id, name: h.name, look: h.look }));
    const o = save.opts, cfg = makeShowConfig(humans, { bots: Math.min(o.bots, MAXP - humans.length), skill: o.skill, length: o.length, scoring: o.scoring });
    NET.inShow = true; broadcastLobby(); netSendAll(cfg); beginShow(cfg); hostStartRound();
}
function netToLobby() { if (!NET.host) return; netSendAll({ t: 'tolobby' }); G.show = null; G.R = null; NET.inShow = false; broadcastLobby(); UI.showLobby(); }
// ---------- launcher hooks (invites, open rooms) ----------
function advertise() {
    const p = LP(); if (!p || !p.HG_partyOpen) return;
    const open = NET.host && /^\d{6}$/.test(NET.code);
    if (open) { try { p.HG_partyOpen({ game: GAME_ID, code: NET.code, n: hostRoster().length, max: MAXP, mode: NET.inShow ? 'Show running' : 'Lobby' }); NET.lpOpen = NET.code; } catch (e) {} }
    else if (NET.lpOpen) { try { p.HG_partyClose(NET.lpOpen); } catch (e) {} NET.lpOpen = ''; }
}
setInterval(advertise, 30000);
window.__hgJoin = code => {
    const c = String(code || '').replace(/\D/g, ''); if (c.length !== 6) return false;
    if (NET.net) netReset();
    UI.showLobby(); netJoin(c); return true;
};
window.__hgHost = convId => {
    if (!NET.net) { UI.showLobby(); netHost(); }
    const t0 = Date.now(), iv = setInterval(() => {
        if (Date.now() - t0 > 25000) return clearInterval(iv);
        if (NET.host && /^\d{6}$/.test(NET.code)) { clearInterval(iv); const p = LP(); try { p && p.HG_sendInvite && p.HG_sendInvite(convId, { game: GAME_ID, code: NET.code, max: MAXP }); } catch (e) {} }
    }, 300);
};
function launcherBoot() {
    const p = LP(); if (!p) return;
    let c = ''; try { c = p.HG_takeJoin ? p.HG_takeJoin(GAME_ID) || '' : ''; } catch (e) {}
    if (c) return window.__hgJoin(c);
    let h = null; try { h = p.HG_takeHost ? p.HG_takeHost(GAME_ID) : null; } catch (e) {}
    if (h && h.convId) window.__hgHost(h.convId);
}
addEventListener('pagehide', () => { if (NET.lpOpen) { try { LP().HG_partyClose(NET.lpOpen); } catch (e) {} } });
