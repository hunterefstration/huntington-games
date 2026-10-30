// ============================================================
// PARTY (HGNet). Create party = host a room with a 6-digit code; members appear in the lobby with their chosen vehicle.
// The leader starts the match for everyone; afterwards everybody returns to the lobby, still in the party.
// ============================================================
const GAME_ID = 'warpvp', PARTY_MAX = 4;
const PARTY = { net: null, host: false, code: '', roster: [], myId: 0, status: '', inMatch: false, vehs: {}, busy: false };
function hgLoad() {
    let h = window.HGNet; try { if (!h && window.parent && window.parent !== window) h = window.parent.HGNet; } catch (e) {}
    if (h) return Promise.resolve(h);
    return new Promise(res => { const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js'; s.onload = () => res(window.HGNet || null); s.onerror = () => res(null); document.head.appendChild(s); });
}
const LP = () => { try { const p = window.parent; return p && p !== window ? p : null; } catch (e) { return null; } };
const myVeh = () => save.lineup[save.sel] || 'g1a';
function partyStatus(t, bad) { PARTY.status = t; PARTY.bad = !!bad; UI.paintParty(); }
function rosterNow() {      // [{id,name,veh}] of everyone in the lobby
    if (!PARTY.net) return [{ id: 0, name: myName(), veh: myVeh() }];
    return PARTY.roster;
}
function hostRoster() {
    const out = [{ id: 0, name: myName(), veh: myVeh() }];
    for (const p of PARTY.net.peers()) if (!p.isHost && p.state !== 'left') out.push({ id: p.id, name: String(p.name || 'Player').slice(0, 16), veh: PARTY.vehs[p.id] || 'g1a' });
    return out.slice(0, PARTY_MAX);
}
function broadcastParty() {
    if (!PARTY.host || !PARTY.net) return;
    PARTY.roster = hostRoster();
    PARTY.net.send('all', { t: 'party', r: PARTY.roster, mode: save.mode, size: save.size, split: save.split });
    UI.paintParty(); UI.refreshLobby();
}
function wireNet(net) {
    net.on('status', t => { if (!PARTY.code) partyStatus(t); });
    net.on('join', peer => { if (PARTY.host) { if (peer.info && peer.info.veh) PARTY.vehs[peer.id] = peer.info.veh; broadcastParty(); } });
    net.on('leave', peer => {
        if (PARTY.host) {
            delete PARTY.vehs[peer.id]; broadcastParty();
            const e = M && EN.get(peer.id); if (e && !M.over) { e.remote = false; e.isBot = true; aiNew(e); e.name = e.name + ' (bot)'; }
        }
    });
    net.on('message', (peer, m) => onNetMsg(peer, m));
    net.on('closed', (reason, text) => {
        const wasMatch = !!M; partyReset(); if (wasMatch) UI.leaveMatch(true);
        toast(reason === 'host-left' ? 'The party leader left.' : (text || 'Left the party.')); UI.refreshLobby(); UI.paintParty();
    });
}
function onNetMsg(peer, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'party') { if (!PARTY.host) { PARTY.roster = m.r; save.mode = m.mode; save.size = m.size; save.split = m.split; UI.paintParty(); UI.refreshLobby(); UI.paintMenuSel(); } return; }
    if (m.t === 'veh') { if (PARTY.host && VBY[m.v]) { PARTY.vehs[peer.id] = m.v; broadcastParty(); } return; }
    if (m.t === 'start') { if (!PARTY.host && m.cfg) { PARTY.inMatch = true; beginMatch(m.cfg, PARTY.myId, false); } return; }
    handleMatchMsg(peer.id, m);
}
function partyReset() {
    try { PARTY.net && PARTY.net.close(); } catch (e) {}
    if (lpOpen) { try { const p = LP(); p && p.HG_partyClose && p.HG_partyClose(lpOpen); } catch (e) {} lpOpen = ''; }
    Object.assign(PARTY, { net: null, host: false, code: '', roster: [], myId: 0, status: '', inMatch: false, vehs: {}, busy: false });
}
function partyCreate() {
    if (PARTY.net || PARTY.busy) return; PARTY.busy = true; partyStatus('Opening a party...');
    hgLoad().then(HG => {
        if (!HG) { PARTY.busy = false; return partyStatus('Parties need the Huntington Games launcher (or a connection to the game servers).', true); }
        const net = HG.create({ game: GAME_ID }); PARTY.net = net; wireNet(net);
        net.host({ name: myName(), maxPlayers: PARTY_MAX, accept: () => PARTY.inMatch ? 'A match is in progress. Try again in a minute.' : true }).then(r => {
            PARTY.host = true; PARTY.code = r.code; PARTY.myId = 0; PARTY.busy = false; partyStatus('Party open. Share the code!'); broadcastParty(); advertise();
        }, e => { PARTY.busy = false; partyReset(); partyStatus(e.message || 'Could not open a party.', true); });
    });
}
function partyJoin(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return partyStatus('Type the 6-digit code.', true);
    if (PARTY.net || PARTY.busy) return; PARTY.busy = true; partyStatus('Joining...');
    hgLoad().then(HG => {
        if (!HG) { PARTY.busy = false; return partyStatus('Parties need the Huntington Games launcher (or a connection to the game servers).', true); }
        const net = HG.create({ game: GAME_ID }); PARTY.net = net; wireNet(net);
        net.join(code, { name: myName(), info: { veh: myVeh() } }).then(r => {
            PARTY.host = false; PARTY.code = r.code || code; PARTY.myId = r.id; PARTY.busy = false; partyStatus('In the party. Waiting for the leader.');
            if (r.hostInfo && r.hostInfo.info) { /* nothing yet */ }
            PARTY.roster = [{ id: 0, name: 'Leader', veh: 'g1a' }, { id: r.id, name: myName(), veh: myVeh() }]; UI.paintParty(); UI.refreshLobby();
        }, e => { PARTY.busy = false; partyReset(); partyStatus(e.message || 'Could not join.', true); });
    });
}
function partyLeave() { partyReset(); UI.paintParty(); UI.refreshLobby(); }
function partyVehChanged() {
    if (!PARTY.net) return;
    if (PARTY.host) broadcastParty(); else PARTY.net.send('host', { t: 'veh', v: myVeh() });
}
function partySettingsChanged() { if (PARTY.host) broadcastParty(); }
// the leader (or solo) starts a match
function startPlay() {
    if (M) return;
    ac();
    if (PARTY.net && !PARTY.host) return toast('Only the party leader can press PLAY.');
    const players = PARTY.net ? hostRoster() : [{ id: 0, name: myName(), veh: myVeh() }];
    const cfg = makeConfig(players, {});
    if (PARTY.net) { PARTY.inMatch = true; PARTY.net.send('all', { t: 'start', cfg }); advertise(); }
    beginMatch(cfg, 0, true);
}
function afterMatch() {         // back to the lobby, still in the party
    PARTY.inMatch = false;
    if (PARTY.host) { broadcastParty(); advertise(); }
}
// ---------- launcher hooks (invites, open parties) ----------
let lpOpen = '';
function advertise() {
    const p = LP(); if (!p || !p.HG_partyOpen) return;
    const open = PARTY.host && /^\d{6}$/.test(PARTY.code) && !PARTY.inMatch;
    if (open) { try { p.HG_partyOpen({ game: GAME_ID, code: PARTY.code, n: rosterNow().length, max: PARTY_MAX, mode: MODES[save.mode].name }); lpOpen = PARTY.code; } catch (e) {} }
    else if (lpOpen) { try { p.HG_partyClose(lpOpen); } catch (e) {} lpOpen = ''; }
}
setInterval(advertise, 30000);
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
    const p = LP(); if (!p) return;
    let c = ''; try { c = p.HG_takeJoin ? p.HG_takeJoin(GAME_ID) || '' : ''; } catch (e) {}
    if (c) return window.__hgJoin(c);
    let h = null; try { h = p.HG_takeHost ? p.HG_takeHost(GAME_ID) : null; } catch (e) {}
    if (h && h.convId) window.__hgHost(h.convId);
}
