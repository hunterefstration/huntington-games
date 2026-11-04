// ==========================================
// HUNTINGTON MINIGAMES: the shared lobby (copied into every minigame by Minigames/build.sh; edit it here).
// Play vs bots right away, or open a room (6-digit code, HGNet = the launcher's multiplayer network) and friends
// join; the host adds bots to fill seats and starts. The host runs the game (and the bots) and tells everyone.
// A game calls MG.init({...}) and gets onStart(roster, seed), onMsg(peerId, msg), onLeave(id) back.
// ==========================================
const MG = { cfg: null, net: null, host: false, solo: false, code: '', me: 0, name: '', roster: [], started: false, bots: 1, adT: 0 };
const MG_BOTS = ['Byte', 'Pixel', 'Turbo', 'Glitch', 'Echo', 'Nova', 'Bolt', 'Rusty', 'Sprocket', 'Zippy'];
const MG_COLS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a78bfa', '#fb923c', '#f87171', '#2dd4bf', '#e879f9', '#fde68a'];
function mgEl(id) { return document.getElementById(id); }
function mgEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function mgCol(i) { return MG_COLS[i % MG_COLS.length]; }
function mgHG() {
    const h = window.HGNet || (() => { try { return window.parent && window.parent.HGNet; } catch (e) { return null; } })();
    if (h) return Promise.resolve(h);
    return new Promise(res => { const s = document.createElement('script'); s.src = '../../gv/vendor/hgnet.js'; s.onload = () => res(window.HGNet || null); s.onerror = () => res(null); document.head.appendChild(s); });
}
function mgMyName() {
    try { const L = window.parent && window.parent.HGGrapevine, me = L && L.me(); if (me) return me.name; } catch (e) {}
    try { return localStorage.getItem('hgmini_name') || 'Player ' + (100 + Math.floor(Math.random() * 900)); } catch (e) { return 'Player'; }
}
function mgSay(t, bad) { const e = mgEl('mg-st'); if (e) { e.textContent = t; e.className = bad ? 'bad' : ''; } }
// ---- the lobby screen
MG.init = function (cfg) {
    MG.cfg = Object.assign({ min: 2, max: 8, bots: 7, defBots: 1, color: '#38bdf8', solo: true }, cfg);
    document.documentElement.style.setProperty('--mg', MG.cfg.color);
    const d = document.createElement('div'); d.id = 'mg-lobby';
    d.innerHTML = `<div class="mg-card"><div class="mg-kicker">Huntington Minigames</div><h1>${mgEsc(cfg.title)}</h1><p class="mg-sub">${cfg.sub || ''}</p>
      <div class="mg-how">${cfg.howto || ''}</div>
      <div class="mg-row">${MG.cfg.solo ? '<button class="mg-btn big" id="mg-solo">Play vs bots</button>' : ''}<button class="mg-btn" id="mg-host">Open a room</button>
        <input id="mg-code" maxlength="7" inputmode="numeric" placeholder="6-digit code" autocomplete="off"><button class="mg-btn" id="mg-join">Join</button></div>
      <div id="mg-st"></div>
      <div id="mg-room" class="hidden"><div class="mg-code">Room code <b id="mg-codev"></b></div><div id="mg-people"></div>
        <div class="mg-row" id="mg-hostrow"><label>Bots <select id="mg-bots"></select></label><button class="mg-btn big" id="mg-start">Start</button></div>
        <div id="mg-wait" class="mg-sub hidden">Waiting for the host to start...</div></div></div>`;
    document.body.appendChild(d);
    const r = document.createElement('div'); r.id = 'mg-res'; r.className = 'hidden'; document.body.appendChild(r);
    const sel = mgEl('mg-bots'); for (let i = 0; i <= MG.cfg.bots; i++) sel.add(new Option(String(i), i)); sel.value = MG.cfg.defBots;
    sel.onchange = () => { MG.bots = +sel.value; mgLobbySend(); };
    MG.bots = MG.cfg.defBots;
    if (mgEl('mg-solo')) mgEl('mg-solo').onclick = () => mgSolo();
    mgEl('mg-host').onclick = () => mgHost();
    mgEl('mg-join').onclick = () => mgJoin(mgEl('mg-code').value);
    mgEl('mg-code').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') mgJoin(mgEl('mg-code').value); };
    mgEl('mg-start').onclick = () => mgStart();
    // the launcher: invites, open parties, Quick Match
    window.__hgJoin = c => { mgShowLobby(); mgEl('mg-code').value = c; mgJoin(c); return true; };
    window.__hgHost = convId => { mgShowLobby(); mgHost(); const iv = setInterval(() => { if (MG.code) { clearInterval(iv); try { window.parent.HG_sendInvite(convId, { game: MG.cfg.id, code: MG.code, max: MG.cfg.max }); } catch (e) {} } }, 300); setTimeout(() => clearInterval(iv), 25000); };
    setTimeout(() => { try { const p = window.parent; if (!p || p === window) return; const c = p.HG_takeJoin && p.HG_takeJoin(MG.cfg.id); if (c) return window.__hgJoin(c); const h = p.HG_takeHost && p.HG_takeHost(MG.cfg.id); if (h && h.convId) window.__hgHost(h.convId); } catch (e) {} }, 400);
    window.__mg = MG;
};
function mgShowLobby() { mgEl('mg-lobby').classList.remove('hidden'); mgEl('mg-res').classList.add('hidden'); }
function mgHideLobby() { mgEl('mg-lobby').classList.add('hidden'); mgEl('mg-res').classList.add('hidden'); }
function mgBotsFor(nHumans, n) { const out = []; for (let i = 0; i < Math.min(n, MG.cfg.max - nHumans); i++) out.push({ id: 100 + i, name: MG_BOTS[i % MG_BOTS.length] + ' (bot)', bot: true }); return out; }
function mgHumans() {
    const out = [{ id: 0, name: MG.host ? MG.name : ((MG.roster.find(r => r.id === 0) || {}).name || 'Host') }];
    if (MG.net && MG.host) for (const p of MG.net.peers()) if (!p.isHost && p.state !== 'left') out.push({ id: p.id, name: String(p.name || 'Player').slice(0, 16) });
    return out;
}
function mgRosterNow() { const h = mgHumans().slice(0, MG.cfg.max); return h.concat(mgBotsFor(h.length, MG.bots)).map((r, i) => Object.assign(r, { col: mgCol(i) })); }
function mgSolo() {
    MG.solo = true; MG.host = true; MG.me = 0; MG.name = mgMyName();
    const bots = Math.max(MG.cfg.min - 1, MG.bots || 1);
    MG.roster = [{ id: 0, name: MG.name }].concat(mgBotsFor(1, bots)).map((r, i) => Object.assign(r, { col: mgCol(i) }));
    mgBegin({ roster: MG.roster, seed: (Math.random() * 1e9) | 0 });
}
function mgWire(net) {
    net.on('message', (peer, m) => {
        if (!m || typeof m !== 'object') return;
        if (m.t === '_lobby' && !MG.host) { MG.roster = m.roster; MG.bots = m.bots; mgPaint(); return; }
        if (m.t === '_start' && !MG.host) return mgBegin(m);
        if (m.t === '_end' && !MG.host) return mgShowEnd(m.html);
        if (m.t === 'g' && MG.cfg.onMsg) MG.cfg.onMsg(peer.id, m.d);
    });
    net.on('join', () => { if (MG.host) mgLobbySend(); });
    net.on('leave', peer => { if (MG.host) { if (!MG.started) mgLobbySend(); else if (MG.cfg.onLeave) MG.cfg.onLeave(peer.id); } mgPaint(); });
    net.on('closed', (r, t) => { if (MG.net !== net) return; MG.net = null; MG.code = ''; MG.started = false; mgShowLobby(); mgEl('mg-room').classList.add('hidden'); mgSay(r === 'host-left' ? 'The host left.' : 'Disconnected' + (t ? ': ' + t : '.'), true); if (MG.cfg.onQuit) MG.cfg.onQuit(); });
}
function mgHost() {
    if (MG.net) return; mgSay('Opening a room...');
    mgHG().then(HG => {
        if (!HG) return mgSay('Playing with friends needs the Huntington Games launcher. "Play vs bots" works anywhere.', true);
        MG.name = mgMyName(); const net = MG.net = HG.create({ game: MG.cfg.id }); mgWire(net);
        net.host({ name: MG.name, maxPlayers: MG.cfg.max, accept: () => MG.started ? 'That game has already started.' : true }).then(r => {
            MG.host = true; MG.solo = false; MG.code = r.code; MG.me = 0; mgSay('Room open: share the code, add bots if you like, then Start.'); mgLobbySend(); mgAdvertise();
        }, e => { MG.net = null; mgSay(e.message || 'Could not open a room.', true); });
    });
}
function mgJoin(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return mgSay('Type the 6-digit code.', true);
    if (MG.net) return; mgSay('Joining...');
    mgHG().then(HG => {
        if (!HG) return mgSay('Playing with friends needs the Huntington Games launcher.', true);
        MG.name = mgMyName(); const net = MG.net = HG.create({ game: MG.cfg.id }); mgWire(net);
        net.join(code, { name: MG.name }).then(r => { MG.host = false; MG.solo = false; MG.code = r.code || code; MG.me = r.id; mgSay('In the room. The host starts the game.'); mgPaint(); },
            e => { MG.net = null; mgSay(e.message || 'Could not join.', true); });
    });
}
function mgAdvertise() {
    clearInterval(MG.adT);
    const ad = () => { try { const p = window.parent; if (p && p !== window && p.HG_partyOpen && MG.host && MG.net && !MG.started) p.HG_partyOpen({ game: MG.cfg.id, code: MG.code, n: mgHumans().length, max: MG.cfg.max, mode: MG.cfg.title }); } catch (e) {} };
    ad(); MG.adT = setInterval(ad, 30000);
}
function mgLobbySend() { if (!MG.host || !MG.net) return; MG.roster = mgRosterNow(); MG.net.send('all', { t: '_lobby', roster: MG.roster, bots: MG.bots }); mgPaint(); }
function mgPaint() {
    const room = mgEl('mg-room'); room.classList.toggle('hidden', !MG.code);
    if (!MG.code) return;
    mgEl('mg-codev').textContent = MG.code;
    const roster = MG.host ? mgRosterNow() : MG.roster;
    mgEl('mg-people').innerHTML = roster.map(r => `<span class="mg-chip"><i style="background:${r.col}"></i>${mgEsc(r.name)}${r.id === 0 ? ' <small>host</small>' : ''}${r.id === MG.me ? ' <small>you</small>' : ''}</span>`).join('');
    mgEl('mg-hostrow').classList.toggle('hidden', !MG.host); mgEl('mg-wait').classList.toggle('hidden', MG.host);
    mgEl('mg-bots').value = MG.bots;
    const need = MG.cfg.min - roster.length; mgEl('mg-start').disabled = need > 0; mgEl('mg-start').textContent = need > 0 ? 'Need ' + need + ' more (add bots)' : 'Start';
}
function mgStart() {
    if (!MG.host) return;
    MG.roster = mgRosterNow(); if (MG.roster.length < MG.cfg.min) return;
    const m = { t: '_start', roster: MG.roster, seed: (Math.random() * 1e9) | 0 };
    if (MG.net) MG.net.send('all', m);
    mgBegin(m);
}
function mgBegin(m) {
    MG.started = true; MG.roster = m.roster; clearInterval(MG.adT);
    try { const p = window.parent; if (p && p !== window && p.HG_partyClose && MG.host && MG.code) p.HG_partyClose(MG.code); } catch (e) {}
    mgHideLobby();
    MG.cfg.onStart(MG.roster, m.seed);
}
// ---- during a game
MG.isHost = () => MG.host || MG.solo;
MG.send = (to, d, fast) => { if (MG.net) try { MG.net.send(to === 'host' ? 'host' : to, { t: 'g', d }, fast ? { fast: true } : undefined); } catch (e) {} };
MG.toAll = (d, fast) => MG.send('all', d, fast);
MG.toHost = (d, fast) => { if (MG.isHost()) { if (MG.cfg.onMsg) MG.cfg.onMsg(MG.me, d); } else MG.send('host', d, fast); };
MG.player = id => MG.roster.find(r => r.id === id);
// the host ends the game for everyone with a results card (html)
MG.end = html => { if (!MG.isHost()) return; if (MG.net) MG.net.send('all', { t: '_end', html }); mgShowEnd(html); };
function mgShowEnd(html) {
    MG.started = false; if (MG.cfg.onEnd) MG.cfg.onEnd();
    const r = mgEl('mg-res'); r.classList.remove('hidden');
    r.innerHTML = `<div class="mg-card">${html}<div class="mg-row">${MG.isHost() ? '<button class="mg-btn big" id="mg-again">Play again</button>' : '<span class="mg-sub">The host can start another round.</span>'}<button class="mg-btn" id="mg-leave">${MG.solo ? 'Menu' : 'Leave'}</button></div></div>`;
    if (mgEl('mg-again')) mgEl('mg-again').onclick = () => { r.classList.add('hidden'); if (MG.solo) mgSolo(); else { mgShowLobby(); mgLobbySend(); mgAdvertise(); } };
    mgEl('mg-leave').onclick = () => { r.classList.add('hidden'); mgLeave(); };
}
function mgLeave() {
    const net = MG.net; MG.net = null; try { net && net.close(); } catch (e) {}
    Object.assign(MG, { host: false, solo: false, code: '', started: false, roster: [] }); clearInterval(MG.adT);
    mgEl('mg-room').classList.add('hidden'); mgSay(''); mgShowLobby(); if (MG.cfg.onQuit) MG.cfg.onQuit();
}
MG.leave = mgLeave;
// a seeded random (the same on every screen when the host sends the seed)
function mgRng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// tiny sounds
const MGS = (() => { let ac = null; const c = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} return ac; };
    const tone = (f, len, type = 'square', vol = 0.06, f2) => { const a = c(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, a.currentTime); if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + len); g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + len); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + len + 0.02); };
    return { blip: () => tone(660, 0.08), hit: () => tone(220, 0.12, 'square', 0.08, 110), win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.08), i * 110)), lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 140)), go: () => tone(880, 0.25, 'sawtooth', 0.07, 1320) }; })();
