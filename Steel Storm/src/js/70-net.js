// ============================================================
// PARTY + LOBBY (HGNet). Create party = host a room with a 6-digit code. The lobby shows two teams (or a free-for-all list):
// click a team to switch, ready up, see everyone's lineup; the host sets the mode / map / length / bots / friendly fire / weather,
// can move, shuffle, balance and kick players, and starts the match. Players can join a running match (they spectate until
// they deploy), come back after a reload or a drop (HGNet keeps the slot 120 s; the score is kept), and if the host leaves the
// next player takes over the room (host migration) or everybody gets a clean return to the menu.
// ============================================================
const GAME_ID = 'warpvp', PARTY_MAX = 8, DROP_MS = 75000;
const PARTY = { net: null, host: false, code: '', roster: [], myId: 0, status: '', bad: false, inMatch: false, busy: false, mem: {}, opts: null, chat: [], rtt: 0, succ: -1, recon: false, migr: null, unread: 0 };
function hgLoad() {
    let h = window.HGNet; try { if (!h && window.parent && window.parent !== window) h = window.parent.HGNet; } catch (e) {}
    if (h) return Promise.resolve(h);
    return new Promise(res => { const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js'; s.onload = () => res(window.HGNet || null); s.onerror = () => res(null); document.head.appendChild(s); });
}
const LP = () => { try { const p = window.parent; return p && p !== window ? p : null; } catch (e) { return null; } };
const myVeh = () => save.lineup[save.sel] || 'g1a';
const myInfo = () => ({ veh: myVeh(), mm: modMask(myVeh()), line: save.lineup.map(id => [id, brOf(vdef(id, modMask(id)))]) });
function partyStatus(t, bad) { PARTY.status = t; PARTY.bad = !!bad; UI.paintParty(); }
function lobbyOpts() { const o = save.opts; return { mode: save.mode, size: save.size, bots: save.bots, diff: save.diff, len: o.len, map: o.map, ff: o.ff, wx: o.wx }; }
function rosterNow() {      // [{id,name,veh,mm,team,ready,line,ping,st}] of everyone in the lobby
    if (!PARTY.net) return [Object.assign({ id: 0, name: myName(), team: 0, ready: true, ping: 0, st: 'connected' }, myInfo())];
    return PARTY.roster;
}
function hostRoster() {
    const me = Object.assign({ id: 0, name: myName(), team: PARTY.mem[0] ? PARTY.mem[0].team : 0, ready: true, ping: 0, st: 'connected', host: true }, myInfo());
    PARTY.mem[0] = Object.assign(PARTY.mem[0] || {}, { team: me.team });
    const out = [me];
    for (const p of PARTY.net.peers()) {
        if (p.isHost || p.state === 'left') continue;
        const m = PARTY.mem[p.id] || (PARTY.mem[p.id] = { team: autoTeam(), ready: false });
        out.push({ id: p.id, name: String(p.name || 'Player').slice(0, 16), veh: VBY[m.veh] ? m.veh : 'g1a', mm: m.mm | 0, line: m.line || [], team: m.team, ready: !!m.ready, ping: p.rtt || 0, st: p.state });
    }
    return out.slice(0, PARTY_MAX);
}
function autoTeam() { const n = [0, 0]; for (const k in PARTY.mem) n[PARTY.mem[k].team | 0]++; return n[0] <= n[1] ? 0 : 1; }
function broadcastParty() {
    if (!PARTY.host || !PARTY.net) return;
    PARTY.roster = hostRoster(); PARTY.opts = lobbyOpts();
    const g = PARTY.roster.filter(p => p.id !== 0).map(p => p.id); PARTY.succ = g.length ? Math.min(...g) : -1;
    PARTY.net.send('all', { t: 'party', r: PARTY.roster, o: PARTY.opts, succ: PARTY.succ, im: PARTY.inMatch ? 1 : 0 });
    UI.paintParty(); UI.refreshLobby();
}
function wireNet(net) {
    net.on('status', t => { if (!PARTY.code) partyStatus(t); });
    net.on('join', peer => {
        if (!PARTY.host) return;
        const info = peer.info || {}, m = PARTY.mem[peer.id] || (PARTY.mem[peer.id] = { team: autoTeam(), ready: false });
        if (info.veh && VBY[info.veh]) { m.veh = info.veh; m.mm = info.mm | 0; m.line = info.line || []; }
        if (PARTY.migr && info.old !== undefined) migrantJoined(peer, info.old);
        else if (M && !M.over && PARTY.inMatch) hostAddPlayer(peer);
        broadcastParty(); advertise();
        if (!PARTY.migr) chatSys(String(peer.name || 'Player').slice(0, 16) + (peer.rejoin ? ' is back' : ' joined'));
    });
    net.on('leave', (peer, reason) => {
        if (PARTY.host) {
            delete PARTY.mem[peer.id]; broadcastParty(); advertise();
            if (M && !M.over) hostPlayerGone(peer.id);
            chatSys(String(peer.name || 'Player').slice(0, 16) + (reason === 'timeout' ? ' timed out' : reason === 'kicked' ? ' was removed' : ' left'));
        }
    });
    net.on('lagging', (peer, on) => { if (PARTY.host && peer) { const e = M && EN.get(peer.id); if (e) e.recon = on; } else if (!PARTY.host) PARTY.lag = !!on; UI.paintParty(); });
    net.on('reconnecting', peer => { if (PARTY.host && peer) { const e = M && EN.get(peer.id); if (e) e.recon = true; } else if (!peer) PARTY.recon = true; UI.paintParty(); });
    net.on('reconnected', (peer, o) => {
        if (PARTY.host && peer) { const e = M && EN.get(peer.id); if (e) e.recon = false; if (o && o.rejoin && M && !M.over) hostAddPlayer(peer); broadcastParty(); }
        else if (!peer) { PARTY.recon = false; PARTY.lag = false; if (M && !M.over) toHost({ t: 'sync?' }); }      // back after a drop: ask for the current state
        UI.paintParty();
    });
    net.on('message', (peer, m) => onNetMsg(peer, m));
    net.on('closed', (reason, text) => {
        if (PARTY.net !== net) return;
        if (reason === 'host-left' && !PARTY.host && PARTY.code && tryMigrate()) return;
        const wasMatch = !!M && !M.over; partyReset(); if (wasMatch) UI.leaveMatch(true);
        UI.notice(reason === 'host-left' ? 'The host left the party.' : reason === 'kicked' ? (text || 'The host removed you from the party.') : reason === 'lost' ? (text || 'Lost the connection to the party.') : (text || 'Left the party.'));
        UI.refreshLobby(); UI.paintParty();
    });
}
function onNetMsg(peer, m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
        case 'party': if (!PARTY.host) { PARTY.roster = m.r; PARTY.opts = m.o; PARTY.succ = m.succ; Object.assign(save, { mode: m.o.mode, size: m.o.size, bots: m.o.bots, diff: m.o.diff }); Object.assign(save.opts, { len: m.o.len, map: m.o.map, ff: m.o.ff, wx: m.o.wx }); UI.paintParty(); UI.refreshLobby(); UI.paintMenuSel(); } return;
        case 'me': if (PARTY.host) { const x = PARTY.mem[peer.id] || (PARTY.mem[peer.id] = { team: autoTeam() }); if (VBY[m.veh]) { x.veh = m.veh; x.mm = m.mm | 0; x.line = Array.isArray(m.line) ? m.line.slice(0, 5) : []; } if (m.ready !== undefined) x.ready = !!m.ready; broadcastParty(); } return;
        case 'team': if (PARTY.host && !PARTY.inMatch) { const x = PARTY.mem[peer.id]; if (x && (m.team === 0 || m.team === 1)) { x.team = m.team; x.ready = false; broadcastParty(); } } return;
        case 'chat': { const n = String(peer && peer.name || 'Player').slice(0, 16); addChat(n, String(m.x || '').slice(0, 140), peer && peer.id); return; }
        case 'start': if (!PARTY.host && m.cfg) { PARTY.inMatch = true; PARTY.migr = null; beginMatch(m.cfg, PARTY.myId, false); if (m.sync) applySync(m.sync); } return;
        case 'lobby': if (!PARTY.host) { PARTY.inMatch = false; UI.paintParty(); } return;
        case 'joinm': if (PARTY.host && M && !M.over) { const pp = PARTY.net.peers().find(x => x.id === peer.id); hostAddPlayer({ id: peer.id, name: pp ? pp.name : peer.name, info: PARTY.mem[peer.id] || {} }); } return;
    }
    handleMatchMsg(peer.id, m);
}
let UNLOADING = false;      // a reload must keep the party code so the page can rejoin (see launcherBoot)
addEventListener('beforeunload', () => { UNLOADING = true; }); addEventListener('pagehide', () => { UNLOADING = true; });
function partyReset() {
    const net = PARTY.net; PARTY.net = null;
    try { net && net.close(); } catch (e) {}
    if (lpOpen) { try { const p = LP(); p && p.HG_partyClose && p.HG_partyClose(lpOpen); } catch (e) {} lpOpen = ''; }
    if (!UNLOADING) try { sessionStorage.removeItem('steelstorm_party'); } catch (e) {}
    Object.assign(PARTY, { net: null, host: false, code: '', roster: [], myId: 0, status: '', bad: false, inMatch: false, busy: false, mem: {}, opts: null, chat: [], succ: -1, recon: false, lag: false, migr: null, unread: 0 });
}
function rememberParty() { try { sessionStorage.setItem('steelstorm_party', JSON.stringify({ code: PARTY.code, at: Date.now(), host: PARTY.host })); } catch (e) {} }
function makeNet(HG) { const net = HG.create({ game: GAME_ID, dropMs: DROP_MS }); PARTY.net = net; wireNet(net); return net; }
function partyCreate(code) {
    if (PARTY.net || PARTY.busy) return; PARTY.busy = true; partyStatus('Opening a party...');
    hgLoad().then(HG => {
        if (!HG) { PARTY.busy = false; return partyStatus('Parties need the Huntington Games launcher (or a connection to the game servers).', true); }
        const net = makeNet(HG);
        net.host({ name: myName(), maxPlayers: PARTY_MAX, code, accept: () => true }).then(r => {
            PARTY.host = true; PARTY.code = r.code; PARTY.myId = 0; PARTY.busy = false; PARTY.mem = { 0: { team: 0, ready: true } };
            partyStatus('Party open. Share the code!'); rememberParty(); broadcastParty(); advertise(); UI.openLobby();
        }, e => { PARTY.busy = false; partyReset(); partyStatus(e.message || 'Could not open a party.', true); });
    });
}
function partyJoin(code, extra) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return partyStatus('Type the 6-digit code.', true);
    if (PARTY.net || PARTY.busy) return Promise.resolve(false); PARTY.busy = true; partyStatus('Joining...');
    return hgLoad().then(HG => {
        if (!HG) { PARTY.busy = false; partyStatus('Parties need the Huntington Games launcher (or a connection to the game servers).', true); return false; }
        const net = makeNet(HG);
        return net.join(code, { name: myName(), info: Object.assign(myInfo(), extra || {}) }).then(r => {
            PARTY.host = false; PARTY.code = r.code || code; PARTY.myId = r.id; PARTY.busy = false; partyStatus(r.rejoined ? 'Back in the party.' : 'In the party.');
            rememberParty();
            PARTY.roster = [{ id: 0, name: (r.hostInfo && r.hostInfo.name) || 'Host', veh: 'g1a', team: 0, ready: true, line: [] }, Object.assign({ id: r.id, name: myName(), team: 1, ready: false }, myInfo())];
            partySendMe(); UI.paintParty(); UI.refreshLobby(); if (!extra) UI.openLobby();
            return true;
        }, e => { PARTY.busy = false; if (PARTY.net === net) { PARTY.net = null; try { net.close(); } catch (er) {} } if (!extra) partyStatus(e.message || 'Could not join.', true); return false; });
    });
}
function partyLeave() { const wasMatch = !!M; partyReset(); if (wasMatch) UI.leaveMatch(true); UI.paintParty(); UI.refreshLobby(); UI.closeLobby(); }
function partySendMe(ready) { if (!PARTY.net || PARTY.host) return; const me = PARTY.roster.find(p => p.id === PARTY.myId); PARTY.net.send('host', Object.assign({ t: 'me', ready: ready !== undefined ? ready : !!(me && me.ready) }, myInfo())); }
function partyVehChanged() { if (!PARTY.net) return; if (PARTY.host) broadcastParty(); else partySendMe(); }
function partySettingsChanged() { if (PARTY.host) broadcastParty(); }
function partyReady(on) {
    if (!PARTY.net) return;
    if (PARTY.host) return;
    const me = PARTY.roster.find(p => p.id === PARTY.myId); if (me) me.ready = on; partySendMe(on); UI.paintParty(); sfx('ready');
}
function partyTeam(t) {
    if (!PARTY.net || PARTY.inMatch) return;
    if (PARTY.host) { PARTY.mem[0].team = t; broadcastParty(); } else { PARTY.net.send('host', { t: 'team', team: t }); const me = PARTY.roster.find(p => p.id === PARTY.myId); if (me) { me.team = t; me.ready = false; } UI.paintParty(); }
}
// host tools
function partyMove(id) { const m = PARTY.mem[id]; if (!PARTY.host || !m) return; m.team = 1 - (m.team | 0); broadcastParty(); }
function partyKick(id) { if (!PARTY.host || !id) return; PARTY.net.kick(id, 'The host removed you from the party.'); delete PARTY.mem[id]; setTimeout(broadcastParty, 50); }
function partyShuffle() { if (!PARTY.host) return; const ids = Object.keys(PARTY.mem).sort(() => Math.random() - .5); ids.forEach((id, i) => PARTY.mem[id].team = i % 2); broadcastParty(); }
function partyBalance() {      // by battle rating: strongest lineups alternate between the teams
    if (!PARTY.host) return; const r = hostRoster().sort((a, b) => Math.max(0, ...(b.line || []).map(x => x[1])) - Math.max(0, ...(a.line || []).map(x => x[1])));
    const sum = [0, 0]; r.forEach(p => { const br = Math.max(1, ...(p.line || []).map(x => x[1])), t = sum[0] <= sum[1] ? 0 : 1; PARTY.mem[p.id].team = t; sum[t] += br; }); broadcastParty();
}
// chat
function addChat(n, x, id) { if (!x) return; PARTY.chat.push({ n, x, id, me: id === PARTY.myId }); if (PARTY.chat.length > 60) PARTY.chat.shift(); if (id !== PARTY.myId) { PARTY.unread++; sfx('chat'); } UI.paintChat(); if (M && !M.over) UI.feedText(n + ': ' + x, -2); }
function chatSys(x) { PARTY.chat.push({ n: '', x, sys: 1 }); if (PARTY.chat.length > 60) PARTY.chat.shift(); UI.paintChat(); if (PARTY.host && PARTY.net) PARTY.net.send('all', { t: 'chat', x: '* ' + x }); }
function sendChat(x) { x = String(x || '').trim().slice(0, 140); if (!x || !PARTY.net) return; PARTY.net.send('all', { t: 'chat', x }); addChat(myName(), x, PARTY.myId); }
// the leader (or solo) starts a match
function startPlay(force) {
    if (M) return;
    ac();
    if (PARTY.net && !PARTY.host) return toast('Only the party host can start.');
    if (PARTY.net) {
        const r = hostRoster(), notReady = r.filter(p => !p.ready && p.id !== 0);
        if (notReady.length && !force && !(PARTY.force && Date.now() - PARTY.force < 6000)) { PARTY.force = Date.now(); return toast(notReady.map(p => p.name).join(', ') + ' not ready. Press START again to start anyway.'); }
    }
    const players = PARTY.net ? hostRoster().map(p => ({ id: p.id, name: p.name, veh: p.veh, mm: p.mm, team: p.team })) : [{ id: 0, name: myName(), veh: myVeh(), mm: modMask(myVeh()) }];
    const cfg = makeConfig(players, PARTY.net ? Object.assign(lobbyOpts(), { split: 1 }) : {});
    if (PARTY.net) { PARTY.inMatch = true; for (const k in PARTY.mem) if (k !== '0') PARTY.mem[k].ready = false; PARTY.net.send('all', { t: 'start', cfg }); broadcastParty(); advertise(); }
    beginMatch(cfg, 0, true);
}
function afterMatch() {         // back to the lobby, still in the party
    PARTY.inMatch = false;
    if (PARTY.host) { if (PARTY.net) PARTY.net.send('all', { t: 'lobby' }); broadcastParty(); advertise(); }
    if (PARTY.net) UI.openLobby();
}
// ---------- host migration: the lowest guest id reopens the room on a code everyone can work out, the others follow ----------
const migCode = c => String(((parseInt(c, 10) * 7 + 13) % 900000) + 100000);
function tryMigrate() {
    const old = PARTY.code, me = PARTY.myId, succ = PARTY.succ; if (succ < 0 || !/^\d{6}$/.test(old)) return false;
    const code = migCode(old), inM = !!M && !M.over, net = PARTY.net;
    PARTY.net = null; try { net.close(); } catch (e) {}
    PARTY.code = ''; PARTY.busy = false; PARTY.recon = false;
    UI.banner('Host left: moving the party to a new host...');
    if (me === succ) {
        partyCreate(code);
        const t0 = Date.now(), iv = setInterval(() => {
            if (PARTY.host && PARTY.code) {
                clearInterval(iv); PARTY.migr = { at: Date.now(), map: {} };
                if (inM && M) becomeMatchHost(me);
                UI.banner(''); chatSys('You are the new host' + (PARTY.code !== code ? ' (new code ' + PARTY.code + ')' : ''));
                setTimeout(() => { if (PARTY.migr) { if (M) for (const id of Object.keys(PARTY.migr.map)) hostPlayerGone(+id); PARTY.migr = null; } }, 25000);
            } else if (Date.now() - t0 > 15000 || (!PARTY.busy && !PARTY.net)) { clearInterval(iv); migrateFailed(); }
        }, 250);
    } else {
        const t0 = Date.now(), attempt = () => {
            if (Date.now() - t0 > 22000) return migrateFailed();
            partyJoin(code, { old: me }).then(ok => { if (ok) { UI.banner(''); chatSys('Moved to the new host.'); } else setTimeout(attempt, 1500); });
        };
        setTimeout(attempt, 2000);
    }
    return true;
}
function migrateFailed() { const wasMatch = !!M; partyReset(); if (wasMatch) UI.leaveMatch(true); UI.banner(''); UI.notice('The host left the party.'); UI.paintParty(); UI.refreshLobby(); }
function becomeMatchHost(oldId) {      // my running match continues with me as host; the others re-attach to their vehicles when they come back
    const rekey = (e, id) => { EN.delete(e.id); e.id = id; EN.set(id, e); };
    const ents = Array.from(EN.values());
    for (const e of ents) if (e !== ME && !e.isBot) { const tmp = 500 + e.id; PARTY.migr.map[tmp] = e.id; rekey(e, tmp); }
    const oh = EN.get(500); if (oh) { delete PARTY.migr.map[500]; rekey(oh, 499); oh.isBot = true; oh.remote = false; aiNew(oh); oh.name += ' (bot)'; }
    for (const e of ents) if (e.isBot) { e.remote = false; aiNew(e); }
    if (ME) rekey(ME, 0); M.meId = 0; M.host = true; PARTY.myId = 0; PARTY.inMatch = true;
    for (const e of EN.values()) if (e.remote) { e.remote = false; e.isBot = true; aiNew(e); }      // until they come back a bot drives
    for (const e of EN.values()) if (PARTY.migr.map[e.id] !== undefined) e.isBot = false;
}
function migrantJoined(peer, old) {
    const tmp = 500 + (old | 0);
    if (M && EN.has(tmp) && PARTY.migr.map[tmp] !== undefined) { const e = EN.get(tmp); EN.delete(tmp); e.id = peer.id; EN.set(peer.id, e); delete PARTY.migr.map[tmp]; e.ai = null; hostAddPlayer(peer); }
    else if (M && !M.over) hostAddPlayer(peer);
}
// ---------- launcher hooks (invites, open parties) ----------
let lpOpen = '';
function advertise() {
    const p = LP(); if (!p || !p.HG_partyOpen) return;
    const open = PARTY.host && /^\d{6}$/.test(PARTY.code);
    if (open) { try { p.HG_partyOpen({ game: GAME_ID, code: PARTY.code, n: rosterNow().length, max: PARTY_MAX, mode: MODES[save.mode].name + (PARTY.inMatch ? ' (in battle)' : '') }); lpOpen = PARTY.code; } catch (e) {} }
    else if (lpOpen) { try { p.HG_partyClose(lpOpen); } catch (e) {} lpOpen = ''; }
}
setInterval(advertise, 30000);
setInterval(() => { if (PARTY.host && PARTY.net && !M) broadcastParty(); else if (PARTY.host && PARTY.net) { PARTY.roster = hostRoster(); } }, 3000);
window.__hgJoin = code => {
    const c = String(code || '').replace(/\D/g, ''); if (c.length !== 6) return false;
    UI.showMenu(); $('#p-code').value = c; partyJoin(c); return true;
};
window.__hgHost = convId => {
    UI.showMenu(); partyCreate();
    const t0 = Date.now(), iv = setInterval(() => {
        if (Date.now() - t0 > 25000) return clearInterval(iv);
        if (PARTY.host && /^\d{6}$/.test(PARTY.code)) { clearInterval(iv); const p = LP(); try { p && p.HG_sendInvite && p.HG_sendInvite(convId, { game: GAME_ID, code: PARTY.code, max: PARTY_MAX }); } catch (e) {} }
    }, 300);
};
function launcherBoot() {
    const p = LP();
    if (p) {
        let c = ''; try { c = p.HG_takeJoin ? p.HG_takeJoin(GAME_ID) || '' : ''; } catch (e) {}
        if (c) return window.__hgJoin(c);
        let h = null; try { h = p.HG_takeHost ? p.HG_takeHost(GAME_ID) : null; } catch (e) {}
        if (h && h.convId) return window.__hgHost(h.convId);
    }
    // came back after a reload in the middle of a party: rejoin (HGNet gives the same player id back within 2 minutes)
    let s = null; try { s = JSON.parse(sessionStorage.getItem('steelstorm_party') || 'null'); } catch (e) {}
    if (s && !s.host && /^\d{6}$/.test(s.code) && Date.now() - s.at < 115000) { partyStatus('Rejoining your party...'); partyJoin(s.code); }
}
