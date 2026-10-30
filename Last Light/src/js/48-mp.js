// ==========================================
// PLAY TOGETHER: up to 6 lights in one level over HGNet (6-digit codes, the launcher's multiplayer network).
// Every player runs their own light and sends where it is ~15 times a second; the others are drawn smoothly on top.
// Bump into someone and they get pushed; F (or the SHOVE button) shoves whoever is in front of you hard.
//   Race: first to the gate wins (the rest have 60 s to finish).   Co-op: done when everyone reaches the gate.
// Each player has a different light (colour + flame shape). In multiplayer you have all three moves, and nothing
// you do changes your saved records (it is its own game).
// ==========================================
const MP = { on: false, net: null, host: false, code: '', mode: 'race', level: 0, players: new Map(), me: 0, ghosts: new Map(), fin: [], t0: 0,
    sendT: 0, shoveT: 0, endT: 0, ended: false, name: '' };
const MP_ABIL = { double: true, wall: true, dash: true };
const MP_MAX = 6;
function mpHG() {
    const h = window.HGNet || (() => { try { return window.parent && window.parent.HGNet; } catch (e) { return null; } })();
    if (h) return Promise.resolve(h);
    return new Promise(res => { const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js'; s.onload = () => res(window.HGNet || null); s.onerror = () => res(null); document.head.appendChild(s); });
}
function mpName() {
    try { const L = window.parent && window.parent.HGGrapevine, me = L && L.me(); if (me) return me.name; } catch (e) {}
    return (localStorage.getItem('lumi_mpname') || 'Light ' + (100 + Math.floor(Math.random() * 900)));
}
function mpStatus(t, bad) { const e = $('#mp-st'); if (e) { e.textContent = t; e.className = bad ? 'bad' : ''; } }
function mpLook(i) { return { pal: i % LUMI_PALS.length, shape: Math.floor(i / 2) % 4 }; }
function mpRoster() {          // host: everyone in the room with their look (by seat)
    const out = [{ id: 0, name: MP.name }];
    if (MP.net) for (const p of MP.net.peers()) if (!p.isHost && p.state !== 'left') out.push({ id: p.id, name: String(p.name || 'Light').slice(0, 16) });
    return out.slice(0, MP_MAX).map((p, i) => Object.assign(p, mpLook(i)));
}
function mpWire(net) {
    net.on('message', (peer, m) => mpMsg(peer, m));
    net.on('join', () => { if (MP.host) mpLobbySend(); });
    net.on('leave', peer => { MP.players.delete(peer.id); MP.ghosts.delete(peer.id); if (MP.host) { mpLobbySend(); mpCheckEnd(); } mpPaintLobby(); });
    net.on('closed', (r, t) => { if (MP.on || $('#s-mp').classList.contains('hidden') === false) { mpReset(); UI.show('title'); G.state = 'title'; titleStats(); toastMsg(r === 'host-left' ? 'The host left.' : 'Disconnected' + (t ? ': ' + t : '.')); } });
}
function toastMsg(t) { const el = $('#toast'); if (!el) return; el.textContent = t; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 2600); }
function mpReset() { try { MP.net && MP.net.close(); } catch (e) {} Object.assign(MP, { on: false, net: null, host: false, code: '', ended: false, fin: [] }); MP.players.clear(); MP.ghosts.clear(); G.mp = null; }
function mpHost() {
    mpStatus('Opening a room...');
    mpHG().then(HG => {
        if (!HG) return mpStatus('Playing together needs the Huntington Games launcher.', true);
        MP.name = mpName(); const net = HG.create({ game: 'lumi' }); MP.net = net; mpWire(net);
        net.host({ name: MP.name, maxPlayers: MP_MAX, accept: () => MP.on ? 'That game has already started.' : true }).then(r => {
            MP.host = true; MP.code = r.code; MP.me = 0; mpStatus('Room open: share the code!'); mpLobbySend();
            mpAdvertise();
        }, e => mpStatus(e.message || 'Could not open a room.', true));
    });
}
function mpJoin(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return mpStatus('Type the 6-digit code.', true);
    mpStatus('Joining...');
    mpHG().then(HG => {
        if (!HG) return mpStatus('Playing together needs the Huntington Games launcher.', true);
        MP.name = mpName(); const net = HG.create({ game: 'lumi' }); MP.net = net; mpWire(net);
        net.join(code, { name: MP.name }).then(r => { MP.host = false; MP.code = r.code || code; MP.me = r.id; mpStatus('In the room. Waiting for the host to start.'); mpPaintLobby(); },
            e => { mpStatus(e.message || 'Could not join.', true); MP.net = null; });
    });
}
let mpAdT = 0;
function mpAdvertise() {        // the launcher lists open rooms (same Wi-Fi / public)
    clearInterval(mpAdT);
    const ad = () => { try { const p = window.parent; if (p && p !== window && p.HG_partyOpen && MP.host && !MP.on) p.HG_partyOpen({ game: 'lumi', code: MP.code, n: mpRoster().length, max: MP_MAX, mode: MP.mode === 'race' ? 'Race' : 'Co-op' }); } catch (e) {} };
    ad(); mpAdT = setInterval(ad, 30000);
}
function mpLobbySend() { if (!MP.host || !MP.net) return; MP.net.send('all', { t: 'lobby', roster: mpRoster(), mode: MP.mode, level: MP.level }); mpPaintLobby(); }
function mpPaintLobby() {
    const box = $('#mp-lobby'); if (!box) return;
    box.classList.toggle('hidden', !MP.net || !MP.code);
    if (!MP.code) return;
    $('#mp-code').textContent = MP.code;
    const roster = MP.host ? mpRoster() : (MP.roster || []);
    $('#mp-people').innerHTML = roster.map(p => `<div class="mpp"><canvas data-look="${p.pal},${p.shape}" width="40" height="44"></canvas>${esc(p.name)}${p.id === 0 ? ' <small>host</small>' : ''}</div>`).join('');
    for (const c of document.querySelectorAll('#mp-people canvas')) { const [pal, shape] = c.dataset.look.split(',').map(Number), x = c.getContext('2d'); x.translate(20, 26);
        Sprites.lumi(x, { x: 0, y: 0, sx: 1, sy: 1, face: 1, vx: 0, vy: 0, blinkSeed: 0, hurtT: 0, pal, shape }, 1); }
    $('#mp-mode').innerHTML = ['race', 'coop'].map(m => `<button data-mpm="${m}" class="btn small${MP.mode === m ? ' on' : ''}" ${MP.host ? '' : 'disabled'}>${m === 'race' ? 'Race' : 'Co-op'}</button>`).join('');
    const sel = $('#mp-level');
    if (!sel.options.length) LEVELS.forEach((l, i) => sel.add(new Option(l.id + ' · ' + l.name, i)));
    sel.value = MP.level; sel.disabled = !MP.host;
    $('#mp-start').classList.toggle('hidden', !MP.host); $('#mp-wait').classList.toggle('hidden', MP.host);
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function mpStartGame() {
    if (!MP.host) return;
    const roster = mpRoster();
    MP.net.send('all', { t: 'start', level: MP.level, mode: MP.mode, roster });
    mpBegin(MP.level, MP.mode, roster);
}
function mpBegin(level, mode, roster) {
    MP.on = true; MP.mode = mode; MP.level = level; MP.fin = []; MP.ended = false; MP.endT = 0; MP.roster = roster;
    MP.players.clear(); MP.ghosts.clear();
    for (const p of roster) MP.players.set(p.id, p);
    const mine = roster.find(p => p.id === MP.me) || roster[0];
    G.mp = { pal: mine.pal, shape: mine.shape };
    G.start(level); G.p.pal = mine.pal; G.p.shape = mine.shape;
    MP.t0 = performance.now();
    UI.banner(mode === 'race' ? 'Race' : 'Co-op', LEVELS[level].name, mode === 'race' ? 'First to the gate wins. F shoves.' : 'Everyone has to reach the gate. F shoves.');
}
function mpMsg(peer, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'lobby') { MP.roster = m.roster; MP.mode = m.mode; MP.level = m.level; mpPaintLobby(); return; }
    if (m.t === 'start') return mpBegin(m.level, m.mode, m.roster);
    if (m.t === 's' && MP.on) {             // where someone is
        const g = MP.ghosts.get(peer.id) || { x: m.x, y: m.y, vx: 0, vy: 0, face: 1, sx: 1, sy: 1, blinkSeed: peer.id, hurtT: 0, tx: m.x, ty: m.y };
        Object.assign(g, { tx: m.x, ty: m.y, vx: m.vx, vy: m.vy, face: m.f, dead: !!m.d, home: !!m.h, lvl: m.l, at: performance.now() });
        const look = MP.players.get(peer.id); if (look) { g.pal = look.pal; g.shape = look.shape; g.name = look.name; }
        MP.ghosts.set(peer.id, g); return;
    }
    if (m.t === 'push' && MP.on && m.to === MP.me && G.p && !G.p.dead) {        // somebody pushed us
        G.p.vx = clamp(G.p.vx + clamp(m.vx, -700, 700), -700, 700); if (m.vy < 0) { G.p.vy = Math.min(G.p.vy, m.vy); G.p.ground = false; }
        G.shake(m.big ? 5 : 2); burst(G, G.p.x, G.p.y, '#ffffff', m.big ? 10 : 4, 160, true); Sound.play(m.big ? 'stomp' : 'land');
        return;
    }
    if (m.t === 'fin' && MP.host && MP.on) { if (!MP.fin.some(f => f.id === peer.id)) MP.fin.push({ id: peer.id, time: m.time }); mpCheckEnd(); return; }
    if (m.t === 'end') return mpShowEnd(m.order, m.mode);
}
// called every physics step while playing together
function mpUpdate(G, dt) {
    if (!MP.on || !MP.net) return;
    const p = G.p, now = performance.now();
    MP.sendT -= dt; MP.shoveT = Math.max(0, MP.shoveT - dt);
    if (MP.sendT <= 0) { MP.sendT = 1 / 15; MP.net.send('all', { t: 's', x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), f: p.face, d: p.dead ? 1 : 0, h: G.done ? 1 : 0, l: MP.level }, { fast: true }); }
    for (const [id, g] of MP.ghosts) {
        g.x = g.x + (g.tx - g.x) * Math.min(1, dt * 14); g.y = g.y + (g.ty - g.y) * Math.min(1, dt * 14);
        if (now - g.at > 8000) MP.ghosts.delete(id);
        // bumping into someone pushes them the way you are going
        if (!p.dead && !g.dead && !g.home && Math.abs(p.x - g.x) < 20 && Math.abs(p.y - g.y) < 24 && Math.abs(p.vx) > 120 && Math.sign(g.x - p.x) === Math.sign(p.vx) && !(g.bumpT > now)) {
            g.bumpT = now + 350; MP.net.send(id, { t: 'push', to: id, vx: p.vx * 0.9, vy: -120 });
        }
    }
    if ((Input.hit('shove')) && MP.shoveT <= 0 && !p.dead) {
        MP.shoveT = 0.8; let hit = 0;
        for (const [id, g] of MP.ghosts) if (!g.dead && !g.home && Math.abs(g.y - p.y) < 34 && (g.x - p.x) * p.face > -6 && Math.abs(g.x - p.x) < 52) {
            MP.net.send(id, { t: 'push', to: id, vx: p.face * 560, vy: -300, big: 1 }); hit++;
        }
        p.sx = 1.25; p.sy = 0.8; burst(G, p.x + p.face * 18, p.y, '#ffffff', 8, 180, true); Sound.play(hit ? 'stomp' : 'dash');
    }
    if (MP.host && MP.endT && now > MP.endT && !MP.ended) mpFinishAll();
}
function mpDraw(x, t) {
    if (!MP.on) return;
    for (const g of MP.ghosts.values()) {
        if (g.dead || g.home || (g.lvl != null && g.lvl !== MP.level)) continue;
        Sprites.lumi(x, g, t);
        x.save(); x.font = 'bold 11px system-ui, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.55)'; const w = x.measureText(g.name || '').width + 10;
        x.fillRect(g.x - w / 2, g.y - 52, w, 15); x.fillStyle = LUMI_PALS[g.pal || 0][1]; x.fillText(g.name || '', g.x, g.y - 41); x.restore();
    }
}
// reaching the gate in multiplayer
function mpFinished(time) {
    const t = Math.round(time * 100) / 100;
    if (MP.host) { if (!MP.fin.some(f => f.id === 0)) MP.fin.push({ id: 0, time: t }); mpCheckEnd(); }
    else MP.net.send('host', { t: 'fin', time: t });
    UI.banner(MP.mode === 'race' ? 'At the gate!' : 'You made it', fmtTime(t), MP.mode === 'race' ? 'Waiting for the others...' : 'Waiting for everyone to reach the gate...');
}
function mpCheckEnd() {
    if (!MP.host || !MP.on || MP.ended) return;
    const n = mpRoster().length;
    if (MP.fin.length >= n) return mpFinishAll();
    if (MP.mode === 'race' && MP.fin.length && !MP.endT) MP.endT = performance.now() + 60000;
}
function mpFinishAll() {
    MP.ended = true;
    const roster = mpRoster(), order = MP.fin.map(f => ({ name: (roster.find(r => r.id === f.id) || {}).name || '?', time: f.time, id: f.id }))
        .concat(roster.filter(r => !MP.fin.some(f => f.id === r.id)).map(r => ({ name: r.name, time: null, id: r.id })));
    MP.net.send('all', { t: 'end', order, mode: MP.mode });
    mpShowEnd(order, MP.mode);
}
function mpShowEnd(order, mode) {
    MP.on = false; G.mp = null; G.state = 'done'; MP.ghosts.clear();
    const place = ['🥇', '🥈', '🥉'];
    $('#mpr-t').textContent = mode === 'race' ? (order[0] && order[0].time != null ? order[0].name + ' wins!' : 'Nobody made it') : (order.every(o => o.time != null) ? 'Everyone made it!' : 'Not everyone made it');
    $('#mpr-rows').innerHTML = order.map((o, i) => `<div class="drow"><span>${mode === 'race' ? (place[i] || (i + 1) + '.') : '•'} ${esc(o.name)}${o.id === MP.me ? ' (you)' : ''}</span><b>${o.time != null ? fmtTime(o.time) : 'did not finish'}</b></div>`).join('');
    $('#hud').classList.add('hidden'); UI.show('mpres');
    // for the launcher's achievements (kept apart from the single-player records)
    const won = mode === 'race' ? order[0] && order[0].id === MP.me && order[0].time != null : order.every(o => o.time != null);
    SAVE.d.mp = SAVE.d.mp || { games: 0, wins: 0 }; SAVE.d.mp.games++; if (won) SAVE.d.mp.wins++; SAVE.write();
    $('#mpr-again').classList.toggle('hidden', !MP.host);
}
// the lobby screen
function mpOpen() { UI.show('mp'); mpStatus(''); mpPaintLobby(); $('#mp-join-code').value = ''; }
function mpBind() {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', () => { Sound.play('click'); fn(); }); };
    on('t-mp', () => { Sound.init && Sound.init(); mpOpen(); });
    on('mp-host', () => { if (!MP.net) mpHost(); });
    on('mp-join', () => { if (!MP.net) mpJoin($('#mp-join-code').value); });
    on('mp-back', () => { mpReset(); UI.show('title'); G.state = 'title'; titleStats(); });
    on('mp-start', () => mpStartGame());
    on('mpr-again', () => { G.state = 'title'; UI.show('mp'); mpLobbySend(); });
    on('mpr-leave', () => { mpReset(); G.state = 'title'; UI.show('title'); titleStats(); });
    $('#s-mp').addEventListener('click', e => { const b = e.target.closest('[data-mpm]'); if (b && MP.host) { MP.mode = b.dataset.mpm; mpLobbySend(); } });
    $('#mp-level').addEventListener('change', e => { MP.level = +e.target.value; mpLobbySend(); });
    $('#mp-join-code').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#mp-join').click(); });
    // the launcher: join from an invite / open party / Quick Match, or host for one
    window.__hgJoin = c => { mpOpen(); $('#mp-join-code').value = c; if (!MP.net) mpJoin(c); return true; };
    window.__hgHost = convId => { mpOpen(); if (!MP.net) mpHost(); const iv = setInterval(() => { if (MP.code) { clearInterval(iv); try { window.parent.HG_sendInvite(convId, { game: 'lumi', code: MP.code, max: MP_MAX }); } catch (e) {} } }, 300); setTimeout(() => clearInterval(iv), 25000); };
    setTimeout(() => { try { const p = window.parent; if (!p || p === window) return; const c = p.HG_takeJoin && p.HG_takeJoin('lumi'); if (c) return window.__hgJoin(c); const h = p.HG_takeHost && p.HG_takeHost('lumi'); if (h && h.convId) window.__hgHost(h.convId); } catch (e) {} }, 400);
}
