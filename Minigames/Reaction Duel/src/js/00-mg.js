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
function mgLauncherName() { try { const L = window.parent && window.parent.HGGrapevine, me = L && L.me(); if (me) return me.name; } catch (e) {} return ''; }
function mgMyName() {
    const ln = mgLauncherName(); if (ln) return ln;
    try { let n = localStorage.getItem('hgmini_name'); if (!n) { n = 'Player ' + (100 + Math.floor(Math.random() * 900)); localStorage.setItem('hgmini_name', n); } return n; } catch (e) { return 'Player'; }
}
function mgLs(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
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
      <div class="mg-row hidden" id="mg-namerow"><label>Your name <input id="mg-name" maxlength="16" autocomplete="off"></label></div>
      <div id="mg-st"></div>
      <div id="mg-room" class="hidden"><div class="mg-code">Room code <b id="mg-codev"></b> <button class="mg-btn sm" id="mg-copy" title="Copy the room code">Copy</button></div><div id="mg-people"></div>
        <div class="mg-row" id="mg-hostrow"><label>Bots <select id="mg-bots"></select></label><button class="mg-btn big" id="mg-start" title="Start (Enter)">Start</button></div>
        <div id="mg-ready" class="mg-sub hidden"></div>
        <div id="mg-wait" class="mg-sub hidden">Waiting for the host to start...</div></div></div>`;
    document.body.appendChild(d);
    const r = document.createElement('div'); r.id = 'mg-res'; r.className = 'hidden'; document.body.appendChild(r);
    const sel = mgEl('mg-bots'); for (let i = 0; i <= MG.cfg.bots; i++) sel.add(new Option(String(i), i)); sel.value = MG.cfg.defBots;
    const bk = 'hgmini_bots_' + MG.cfg.id, sb = parseInt(mgLs(bk), 10);     // the bot count you picked last time
    sel.onchange = () => { MG.bots = +sel.value; mgLs(bk, String(MG.bots)); mgLobbySend(); };
    MG.bots = sb >= 0 && sb <= MG.cfg.bots ? sb : MG.cfg.defBots; sel.value = MG.bots;
    if (!mgLauncherName()) {     // not signed in to the launcher: the name can be changed here and is remembered
        const ni = mgEl('mg-name'); mgEl('mg-namerow').classList.remove('hidden'); ni.value = mgMyName();
        ni.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ni.blur(); };
        ni.onchange = () => { const v = ni.value.replace(/\s+/g, ' ').trim().slice(0, 16); if (v) mgLs('hgmini_name', v); ni.value = mgMyName(); };
    }
    mgEl('mg-copy').onclick = () => mgCopyCode();
    mgQolInit();
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
        if (m.t === '_lobby' && !MG.host) { MG.roster = m.roster; MG.bots = m.bots; if (m.room && !MG.started) mgShowLobby(); mgPaint(); return; }
        if (m.t === '_start' && !MG.host) return mgBegin(m);
        if (m.t === '_end' && !MG.host) return mgShowEnd(m.html);
        if (m.t === 'g' && MG.cfg.onMsg) MG.cfg.onMsg(peer.id, m.d);
    });
    net.on('join', () => { if (MG.host) mgLobbySend(); });
    net.on('leave', peer => { if (MG.host) { if (!MG.started) mgLobbySend(); else if (MG.cfg.onLeave) MG.cfg.onLeave(peer.id); } mgPaint(); });
    net.on('closed', (r, t) => { if (MG.net !== net) return; MG.net = null; MG.code = ''; MG.started = false; mgShowLobby(); mgEl('mg-room').classList.add('hidden'); mgConfirmClose(); mgSay(r === 'host-left' ? 'The host left, so the room closed. Open your own room or play vs bots.' : 'Disconnected' + (t ? ': ' + t : '.'), true); if (MG.cfg.onQuit) MG.cfg.onQuit(); });
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
function mgLobbySend(room) { if (!MG.host || !MG.net) return; MG.roster = mgRosterNow(); MG.net.send('all', room ? { t: '_lobby', roster: MG.roster, bots: MG.bots, room: 1 } : { t: '_lobby', roster: MG.roster, bots: MG.bots }); mgPaint(); }
function mgPaint() {
    const room = mgEl('mg-room'); room.classList.toggle('hidden', !MG.code);
    if (!MG.code) return;
    mgEl('mg-codev').textContent = MG.code;
    const roster = MG.host ? mgRosterNow() : MG.roster;
    mgEl('mg-people').innerHTML = roster.map(r => `<span class="mg-chip"><i style="background:${r.col}"></i>${mgEsc(r.name)}${r.id === 0 ? ' <small>host</small>' : ''}${r.id === MG.me ? ' <small>you</small>' : ''}</span>`).join('');
    mgEl('mg-hostrow').classList.toggle('hidden', !MG.host); mgEl('mg-wait').classList.toggle('hidden', MG.host);
    mgEl('mg-bots').value = MG.bots;
    const need = MG.cfg.min - roster.length; mgEl('mg-start').disabled = need > 0; mgEl('mg-start').textContent = need > 0 ? 'Need ' + need + ' more (add bots)' : 'Start';
    const humans = roster.filter(r => !r.bot).length, rd = mgEl('mg-ready');
    rd.classList.toggle('hidden', !MG.host);
    rd.textContent = need > 0 ? 'Waiting for players: share the code, or add bots.' : 'Ready! ' + humans + (humans === 1 ? ' player' : ' players') + ' here. Press Start or Enter when everyone has joined.';
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
    const room = !MG.solo && MG.isHost();
    r.innerHTML = `<div class="mg-card">${html}<div class="mg-row">${MG.isHost() ? '<button class="mg-btn big" id="mg-again" title="Enter or R">Play again</button>' : '<span class="mg-sub">Waiting for the host to start another round...</span>'}${room ? '<button class="mg-btn" id="mg-room-back" title="Change bots or wait for more people">Back to room</button>' : ''}<button class="mg-btn" id="mg-leave">${MG.solo ? 'Menu' : 'Leave'}</button></div>${room ? '<div class="mg-sub">Play again starts a new round for everyone in the room.</div>' : ''}</div>`;
    const toRoom = () => { r.classList.add('hidden'); mgShowLobby(); mgLobbySend(true); mgAdvertise(); };
    if (mgEl('mg-again')) mgEl('mg-again').onclick = () => {     // a rematch with the same people in one click
        if (MG.solo) { r.classList.add('hidden'); mgSolo(); return; }
        if (mgRosterNow().length >= MG.cfg.min) { r.classList.add('hidden'); mgStart(); } else toRoom();
    };
    if (mgEl('mg-room-back')) mgEl('mg-room-back').onclick = toRoom;
    mgEl('mg-leave').onclick = () => { r.classList.add('hidden'); mgLeave(); };
}
function mgLeave() {
    const net = MG.net; MG.net = null; try { net && net.close(); } catch (e) {}
    Object.assign(MG, { host: false, solo: false, code: '', started: false, roster: [] }); clearInterval(MG.adT);
    mgEl('mg-room').classList.add('hidden'); mgSay(''); mgConfirmClose(); mgShowLobby(); if (MG.cfg.onQuit) MG.cfg.onQuit();
}
// ---- quality of life: sound toggle (M), copy code, keyboard, leave confirm (Esc)
function mgCopyCode() {
    const b = mgEl('mg-copy'), done = ok => { b.textContent = ok ? 'Copied!' : 'Copy failed'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); };
    const fallback = () => { try { const t = document.createElement('textarea'); t.value = MG.code; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); done(ok); } catch (e) { done(false); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(MG.code).then(() => done(true), fallback); else fallback(); } catch (e) { fallback(); }
}
function mgPaintSnd() { const b = mgEl('mg-snd'); if (b) { b.textContent = MGS.muted ? '🔇' : '🔊'; b.title = MGS.muted ? 'Sound off (M)' : 'Sound on (M)'; } }
function mgToggleSnd() { MGS.muted = !MGS.muted; mgLs('hgmini_mute', MGS.muted ? '1' : '0'); mgPaintSnd(); if (!MGS.muted) MGS.blip(); }
function mgVisible(id) { const e = mgEl(id); return !!e && !e.classList.contains('hidden'); }
function mgConfirmClose() { const c = mgEl('mg-confirm'); if (c) c.classList.add('hidden'); }
function mgConfirmLeave() {
    let c = mgEl('mg-confirm');
    if (!c) {
        c = document.createElement('div'); c.id = 'mg-confirm'; c.className = 'hidden';
        c.innerHTML = '<div class="mg-card"><h2>Leave this match?</h2><p class="mg-sub" id="mg-confirm-t"></p><div class="mg-row"><button class="mg-btn big" id="mg-confirm-stay" title="Esc">Keep playing</button><button class="mg-btn" id="mg-confirm-go" title="Enter">Leave</button></div></div>';
        document.body.appendChild(c);
        mgEl('mg-confirm-stay').onclick = mgConfirmClose;
        mgEl('mg-confirm-go').onclick = () => { mgConfirmClose(); mgLeave(); };
    }
    mgEl('mg-confirm-t').textContent = MG.solo ? 'This round ends and you go back to the menu.' : MG.host ? 'You are the host: leaving ends the game for everyone.' : 'You leave the room; the others keep playing.';
    c.classList.remove('hidden');
}
function mgQolInit() {
    MGS.muted = mgLs('hgmini_mute') === '1';
    const b = document.createElement('button'); b.id = 'mg-snd'; b.className = 'mg-btn sm'; b.onclick = e => { e.stopPropagation(); mgToggleSnd(); b.blur(); };
    document.body.appendChild(b); mgPaintSnd();
    addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
        if (mgVisible('mg-confirm')) {     // the leave question takes every key while it is up
            if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); mgConfirmClose(); }
            else if (e.code === 'Enter' && !(t && t.tagName === 'BUTTON')) { e.preventDefault(); e.stopImmediatePropagation(); mgConfirmClose(); mgLeave(); }
            return;
        }
        if (typing) return;
        if (e.code === 'KeyM' && !e.repeat) { mgToggleSnd(); return; }
        if (mgVisible('mg-res')) {
            if ((e.code === 'Enter' || e.code === 'KeyR') && !e.repeat && !(t && t.tagName === 'BUTTON' && e.code === 'Enter') && mgEl('mg-again')) { e.preventDefault(); e.stopImmediatePropagation(); mgEl('mg-again').click(); }
            return;
        }
        if (mgVisible('mg-lobby')) {
            if (e.code === 'Enter' && !e.repeat && MG.host && MG.code && !(t && t.tagName === 'BUTTON') && !mgEl('mg-start').disabled) { e.preventDefault(); e.stopImmediatePropagation(); mgStart(); }
            return;
        }
        if (e.code === 'Escape' && MG.started && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); mgConfirmLeave(); }
    }, true);
}
MG.leave = mgLeave;
// a seeded random (the same on every screen when the host sends the seed)
function mgRng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// tiny sounds
const MGS = (() => { let ac = null; const c = () => { if (MGS.muted) return null; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} return ac; };
    const tone = (f, len, type = 'square', vol = 0.06, f2) => { const a = c(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, a.currentTime); if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + len); g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + len); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + len + 0.02); };
    return { blip: () => tone(660, 0.08), hit: () => tone(220, 0.12, 'square', 0.08, 110), win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.08), i * 110)), lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 140)), go: () => tone(880, 0.25, 'sawtooth', 0.07, 1320) }; })();
