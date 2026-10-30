// ===================== Multiplayer: Race or Co-op, with people and bots =====================
// The host opens a room (6-digit code, HGNet = the launcher's multiplayer network) and picks the mode, how many
// people can join, how many bots, the first level and how many rounds. Everybody plays the same level (generated
// levels use the same seed), runs their own cube and sends where it is ~15 times a second. The host runs the bots.
//   Race:  first to the goal scores 5, then 3, 2, and 1 for finishing. The round ends 8 s after the winner.
//   Co-op: the round ends when everyone (bots too) reaches the goal. Team deaths are counted.
// Dying respawns you at the start straight away (the roast still shows). Nothing here changes your saved progress.
const MPS = { on: false, net: null, host: false, code: '', me: 0, name: '', mode: 'race', people: 4, bots: 3, startLv: 1, rounds: 5,
    round: 0, level: 0, seed: 1, roster: [], others: new Map(), bots_: new Map(), fin: [], scores: {}, teamDeaths: 0, spawn: null,
    done: false, deadT: 0, sendT: 0, endAt: 0, between: false, started: false };
const MP_COLS = ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a78bfa', '#fb923c', '#f87171', '#2dd4bf', '#e879f9', '#fde68a'];
const BOT_NAMES = ['Spikebot', 'Jumpy', 'Cubert', 'Bouncer', 'Pixel', 'Zap', 'Blocky Jr', 'Turbo', 'Glitch'];
function mpActive() { return MPS.on; }
function mpCol(id) { return id === MPS.me ? '#38bdf8' : MP_COLS[1 + ((id >= 900 ? id - 900 + 4 : id) % 9)]; }      // you are always blue
function mpLevel() { return MPS.on ? MPS.level : 0; }
function mpEl(id) { return document.getElementById(id); }
function mpEsc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function mpHG() {
    const h = window.HGNet || (() => { try { return window.parent && window.parent.HGNet; } catch (e) { return null; } })();
    if (h) return Promise.resolve(h);
    return new Promise(res => { const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js'; s.onload = () => res(window.HGNet || null); s.onerror = () => res(null); document.head.appendChild(s); });
}
function mpMyName() {
    try { const L = window.parent && window.parent.HGGrapevine, me = L && L.me(); if (me) return me.name; } catch (e) {}
    try { return localStorage.getItem('spikes100_mpname') || 'Player ' + (100 + Math.floor(Math.random() * 900)); } catch (e) { return 'Player'; }
}
function mpSay(t, bad) { const e = mpEl('mpStatus'); if (e) { e.textContent = t; e.style.color = bad ? '#fda4af' : '#bae6fd'; } }

// ---- seeded levels: the generated levels (1-50) use Math.random, so every player loads them with the same seed
function mpRng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mpLoadLevel(level, seed) {
    const r0 = Math.random, unlocked = progress.unlocked;
    Math.random = mpRng(seed);
    try { playMode = 'campaign'; isOneLife = false; isEndless = false; currentLevel = level; loadCampaignLevel(level); }
    finally { Math.random = r0; }
    if (progress.unlocked !== unlocked) { progress.unlocked = unlocked; saveProgress(); }      // (multiplayer does not unlock levels)
    MPS.level = level; MPS.seed = seed; MPS.spawn = { x: player.x, y: player.y }; MPS.done = false; MPS.deadT = 0; MPS.fin = []; MPS.endAt = 0; MPS.between = false; MPS.roundT0 = Date.now();
    MPS.others.forEach(o => { o.fin = false; o.dead = false; });
    MPS.bots_.forEach(b => mpBotReset(b));
    modeDisplay.textContent = (MPS.mode === 'race' ? 'RACE' : 'CO-OP') + ' · ROUND ' + MPS.round + '/' + MPS.rounds;
    mpBoard();
}

// ---- one frame of play (replaces updatePhysics while multiplayer is on)
function mpStep() {
    worldStep();
    if (MPS.between) { /* waiting for the next round */ }
    else if (MPS.deadT > 0) { if (--MPS.deadT === 0) mpRespawn(); }
    else if (!MPS.done) {
        const r = bodyStep();
        if (r === 1) mpDie(); else if (r === 2) mpFinish();
    }
    if (MPS.host && !MPS.between) mpBotsStep();
    if (--MPS.sendT <= 0 && MPS.net) {
        MPS.sendT = 4;
        MPS.net.send('all', { t: 's', x: Math.round(player.x), y: Math.round(player.y), vx: Math.round(player.vx * 10) / 10, vy: Math.round(player.vy * 10) / 10, g: player.grav, d: MPS.deadT > 0 ? 1 : 0, f: MPS.done ? 1 : 0, l: MPS.level }, { fast: true });
        if (MPS.host && MPS.bots_.size) MPS.net.send('all', { t: 'b', l: MPS.level, b: [...MPS.bots_.values()].map(b => [b.id, Math.round(b.p.x), Math.round(b.p.y), b.p.grav, b.deadT > 0 ? 1 : 0, b.fin ? 1 : 0, Math.round(b.p.vx)]) }, { fast: true });
    }
    if (MPS.host && !MPS.between && ((MPS.endAt && Date.now() > MPS.endAt) || Date.now() - MPS.roundT0 > (MPS.mode === 'race' ? 180000 : 300000))) mpRoundOver();
    for (const o of MPS.others.values()) { o.x += (o.tx - o.x) * 0.3; o.y += (o.ty - o.y) * 0.3; }
}
function mpDie() {
    createParticles(player.x + player.w / 2, player.y + player.h / 2, 30, '#38bdf8');
    if (typeof deathInsult === 'function') showToast(deathInsult());
    MPS.deadT = 36; totalDeaths++; deathDisplay.textContent = 'Deaths: ' + totalDeaths;
    if (MPS.mode === 'coop') { if (MPS.host) { MPS.teamDeaths++; mpBoard(); } else MPS.net.send('host', { t: 'died' }); }
}
function mpRespawn() {
    // start over from the beginning of this level: keys and doors come back (your own copy of them)
    for (let i = 0; i < keyItems.length; i++) keyItems[i].taken = false;
    for (let i = 0; i < doorGroups.length; i++) for (let j = 0; j < doorGroups[i].length; j++) doorGroups[i][j].active = true;
    resetPlayer(MPS.spawn.x, MPS.spawn.y); updateKeyHud();
    camera.x = clampCam(player.x - canvas.width / 3);
}
function mpFinish() {
    MPS.done = true; createParticles(goal.x + goal.w / 2, goal.y + goal.h / 2, 50, '#10b981');
    if (MPS.host) mpGotFinish(MPS.me); else MPS.net.send('host', { t: 'fin', l: MPS.level });
    showToast(MPS.mode === 'race' ? 'Made it! Waiting for the others...' : 'Made it! Waiting for your team...');
}

// ---- bots (the host runs them): each one looks ahead with the real physics and picks the move that gets furthest
function mpMakeBot(id, name) {
    const b = { id, name, bot: true, p: Object.assign({}, player, { tk: [], od: {} }), keys: { left: false, right: true, jump: false },
        act: 2, cd: id % 5, deadT: 0, fin: false, best: 0, bestT: 0, skill: 0.78 + Math.random() * 0.2 };
    mpBotReset(b); return b;
}
function mpBotReset(b) {
    Object.assign(b.p, { x: MPS.spawn ? MPS.spawn.x : player.x, y: MPS.spawn ? MPS.spawn.y : player.y, vx: 0, vy: 0, grounded: false, coyoteTimer: 0, jumpBufferTimer: 0, grav: 1, keys: 0, bounced: false, groundKind: 0, groundIdx: -1, inZone: false, tk: [], od: {} });
    b.deadT = 0; b.fin = false; b.cd = b.id % 5;
    if (b.lvl !== MPS.level) { b.lvl = MPS.level; b.best = -1e9; b.bestT = Date.now(); }
}
function mpGoalScore(p) { return -Math.abs(goal.x + goal.w / 2 - (p.x + p.w / 2)) - Math.abs(goal.y + goal.h / 2 - (p.y + p.h / 2)) * 0.35; }
const BOT_ACTS = [[0, 1, 0], [0, 1, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]];          // [left, right, jump]
function mpBotThink(b) {
    const snap = simSnapshot(), tk = b.p.tk.slice(), od = Object.assign({}, b.p.od), cam = camera.x, was = simMode;
    simMode = true;
    const dir = goal.x + goal.w / 2 >= b.p.x ? 1 : -1, scores = [];
    for (let a = 0; a < BOT_ACTS.length; a++) {
        let best = -1e9;
        for (let c = 0; c < 4; c++) {
            simRestore(snap); b.p.tk = tk.slice(); b.p.od = Object.assign({}, od);
            let s = -1e9, dead = false;
            // then one of four ways to carry on: run, run + jump, stand, run and jump a bit later
            for (let f = 0; f < 48; f++) {
                const go = c === 2 ? 0 : 1, jmp = c === 1 || (c === 3 && f >= 16);
                const A = f < 6 ? BOT_ACTS[a] : [go && dir < 0 ? 1 : 0, go && dir > 0 ? 1 : 0, jmp ? 1 : 0];
                const r = simStep(A[0], A[1], A[2]);
                if (r === 1) { dead = true; break; }
                if (r === 2) { s = 1e6 - f; break; }
                s = Math.max(s, mpGoalScore(player));
            }
            if (dead) s = -1e8 + s * 0.001;
            best = Math.max(best, s);
        }
        scores.push(best);
    }
    simRestore(snap); b.p.tk = tk; b.p.od = od; camera.x = cam; simMode = was;
    let pick = 0; for (let a = 1; a < scores.length; a++) if (scores[a] > scores[pick] + 0.5 || (Math.abs(scores[a] - scores[pick]) <= 0.5 && a === b.act)) pick = a;
    if (Math.random() > b.skill * 1.1 && scores.length) {             // now and then a bot makes a human-ish mistake
        const ok = scores.map((s, i) => [s, i]).filter(x => x[0] > -1e7 && x[1] !== pick); if (ok.length) pick = ok[Math.floor(Math.random() * ok.length)][1];
    }
    return pick;
}
function mpBotsStep() {
    if (!MPS.bots_.size) return;
    const me = player, mk = { left: keys.left, right: keys.right, jump: keys.jump }, cam = camera.x;
    for (const b of MPS.bots_.values()) {
        if (b.fin) continue;
        player = b.p;
        if (b.deadT > 0) { if (--b.deadT === 0) mpBotReset(b); player = me; continue; }
        keys.left = b.keys.left; keys.right = b.keys.right; keys.jump = b.keys.jump;
        if (--b.cd <= 0) {
            b.act = mpBotThink(b); b.cd = 5;
            const A = BOT_ACTS[b.act]; if (A[2] && !b.keys.jump) player.jumpBufferTimer = 8;
            b.keys.left = keys.left = !!A[0]; b.keys.right = keys.right = !!A[1]; b.keys.jump = keys.jump = !!A[2];
        }
        const r = bodyStep();
        if (r === 1) { b.deadT = 36; createParticles(b.p.x + 12, b.p.y + 12, 18, mpCol(b.id)); if (MPS.mode === 'coop') { MPS.teamDeaths++; mpBoard(); } }
        else if (r === 2) { b.fin = true; mpGotFinish(b.id); }
        else {
            const sc = mpGoalScore(b.p);
            if (sc > b.best + 8) { b.best = sc; b.bestT = Date.now(); }
            else if (Date.now() - b.bestT > 14000) {          // stuck: in co-op it gets carried to the goal, in a race it starts over
                if (MPS.mode === 'coop') { b.fin = true; mpGotFinish(b.id); } else { mpBotReset(b); }
            }
        }
        b.keys.jump = keys.jump;
    }
    player = me; keys.left = mk.left; keys.right = mk.right; keys.jump = mk.jump; camera.x = cam;
}

// ---- rounds (the host decides)
function mpRosterIds() { return MPS.roster.map(r => r.id); }
function mpGotFinish(id) {
    if (!MPS.host || MPS.between || MPS.fin.includes(id)) return;
    MPS.fin.push(id);
    if (MPS.mode === 'race') { const pts = [5, 3, 2][MPS.fin.length - 1] || 1; MPS.scores[id] = (MPS.scores[id] || 0) + pts; if (MPS.fin.length === 1) MPS.endAt = Date.now() + 8000; }
    MPS.net.send('all', { t: 'fin', id, scores: MPS.scores, fin: MPS.fin });
    mpBoard();
    if (mpRosterIds().every(i => MPS.fin.includes(i))) mpRoundOver();
}
function mpRoundOver() {
    if (!MPS.host || MPS.between) return;
    MPS.endAt = 0;
    const last = MPS.round >= MPS.rounds || MPS.startLv + MPS.round > MAX_LEVELS;
    const next = last ? null : { level: MPS.startLv + MPS.round, seed: (Math.random() * 1e9) | 0 };
    const msg = { t: 'round', fin: MPS.fin, scores: MPS.scores, teamDeaths: MPS.teamDeaths, next, round: MPS.round };
    MPS.net.send('all', msg); mpOnRound(msg);
}
function mpOnRound(m) {
    MPS.between = true; MPS.scores = m.scores || MPS.scores; MPS.teamDeaths = m.teamDeaths || 0; mpBoard();
    const name = id => (MPS.roster.find(r => r.id === id) || {}).name || '?';
    if (MPS.mode === 'race') showToast(m.fin && m.fin.length ? name(m.fin[0]) + ' wins round ' + m.round + '!' : 'Nobody made it this round');
    else showToast(m.fin && m.fin.length >= MPS.roster.length ? 'Team cleared round ' + m.round + '!' : 'Round ' + m.round + ' over');
    setTimeout(() => { if (!MPS.on) return; if (m.next) { MPS.round++; mpLoadLevel(m.next.level, m.next.seed); } else mpGameOver(); }, 3000);
}
function mpGameOver() {
    gameState = 'MENU'; hud.classList.add('hidden'); pauseBtn.classList.add('hidden'); mpEl('mpBoard').classList.add('hidden');
    const rows = MPS.roster.slice().sort((a, b) => (MPS.scores[b.id] || 0) - (MPS.scores[a.id] || 0));
    mpEl('mpResTitle').textContent = MPS.mode === 'race' ? (rows[0] ? rows[0].name + ' wins!' : 'Game over') : 'Your team cleared ' + MPS.rounds + ' levels';
    mpEl('mpResRows').innerHTML = MPS.mode === 'race'
        ? rows.map((r, i) => `<div class="mp-row"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} <i style="background:${mpCol(r.id)}"></i>${mpEsc(r.name)}${r.bot ? ' <small>bot</small>' : ''}${r.id === MPS.me ? ' (you)' : ''}</span><b>${MPS.scores[r.id] || 0} pts</b></div>`).join('')
        : `<div class="mp-row"><span>Team deaths</span><b>${MPS.teamDeaths}</b></div><div class="mp-row"><span>Your deaths</span><b>${totalDeaths}</b></div>`;
    hideAllScreens(); mpEl('mpResults').classList.remove('hidden');
    mpEl('mpAgainBtn').classList.toggle('hidden', !MPS.host);
    MPS.started = false; mpAdvertise();
    // for the launcher's achievements
    progress.mpGames = (progress.mpGames || 0) + 1;
    if (MPS.mode === 'race' ? rows[0] && rows[0].id === MPS.me && (MPS.scores[MPS.me] || 0) > 0 : true) progress.mpWins = (progress.mpWins || 0) + 1;
    saveProgress();
}
function mpBoard() {
    const el = mpEl('mpBoard'); if (!el) return;
    el.classList.toggle('hidden', !MPS.on || gameState === 'MENU');
    if (MPS.mode === 'coop') { el.innerHTML = `<b>CO-OP</b> · team deaths ${MPS.teamDeaths} · at the goal ${MPS.fin.length}/${MPS.roster.length}`; return; }
    el.innerHTML = MPS.roster.slice().sort((a, b) => (MPS.scores[b.id] || 0) - (MPS.scores[a.id] || 0)).slice(0, 6)
        .map(r => `<div><i style="background:${mpCol(r.id)}"></i>${mpEsc(r.name)}${MPS.fin.includes(r.id) ? ' ✔' : ''}<b>${MPS.scores[r.id] || 0}</b></div>`).join('');
}

// ---- drawing everyone else (called from draw(), in world space)
function mpDrawOthers(g) {
    if (!MPS.on) return;
    const list = [];
    for (const o of MPS.others.values()) if (o.l === MPS.level && !o.dead && !(o.fin && MPS.mode === 'race')) list.push(o);
    if (MPS.host) for (const b of MPS.bots_.values()) if (!b.deadT && !b.fin) list.push({ x: b.p.x, y: b.p.y, g: b.p.grav, vx: b.p.vx, id: b.id, name: b.name });
    g.save(); g.font = 'bold 11px "Segoe UI", sans-serif'; g.textAlign = 'center';
    for (const o of list) {
        const col = mpCol(o.id); g.globalAlpha = 0.8; g.shadowColor = col; g.shadowBlur = 10;
        drawPlayerShape(g, o.x, o.y, 24, 24, o.g || 1, o.vx || 0, col); g.shadowBlur = 0;
        g.globalAlpha = 0.9; g.fillStyle = col; g.fillText(o.name || '', o.x + 12, (o.g || 1) > 0 ? o.y - 6 : o.y + 38);
    }
    g.restore();
}

// ---- the network
function mpWire(net) {
    net.on('message', (peer, m) => mpMsg(peer, m));
    net.on('join', () => { if (MPS.host) mpLobbySend(); });
    net.on('leave', peer => {
        MPS.others.delete(peer.id); MPS.roster = MPS.roster.filter(r => r.id !== peer.id);
        if (MPS.host) { mpLobbySend(); if (MPS.started && !MPS.between && mpRosterIds().every(i => MPS.fin.includes(i))) mpRoundOver(); }
        mpBoard(); mpPaintLobby();
    });
    net.on('closed', (r, t) => { if (MPS.net === net) { mpLeave(); showToast(r === 'host-left' ? 'The host left the game.' : 'Disconnected' + (t ? ': ' + t : '.'), true); } });
}
function mpHumans() {
    const out = [{ id: 0, name: MPS.host ? MPS.name : ((MPS.roster.find(r => r.id === 0) || {}).name || 'Host') }];
    if (MPS.net && MPS.host) for (const p of MPS.net.peers()) if (!p.isHost && p.state !== 'left') out.push({ id: p.id, name: String(p.name || 'Player').slice(0, 16) });
    return out;
}
function mpLobbyRoster() {
    const hum = mpHumans().slice(0, MPS.people), bots = [];
    for (let i = 0; i < Math.min(MPS.bots, 10 - hum.length); i++) bots.push({ id: 900 + i, name: BOT_NAMES[i % BOT_NAMES.length], bot: true });
    return hum.concat(bots);
}
function mpLobbySend() {
    if (!MPS.host || !MPS.net) return;
    if (!MPS.started) MPS.roster = mpLobbyRoster();
    MPS.net.send('all', { t: 'lobby', roster: MPS.roster, mode: MPS.mode, people: MPS.people, bots: MPS.bots, startLv: MPS.startLv, rounds: MPS.rounds, started: MPS.started });
    mpPaintLobby(); mpAdvertise();
}
let mpAdT = 0;
function mpAdvertise() {
    clearInterval(mpAdT); if (!MPS.host || !MPS.code) return;
    const ad = () => { try { const p = window.parent; if (p && p !== window && p.HG_partyOpen && MPS.host && !MPS.started) p.HG_partyOpen({ game: 'spikes', code: MPS.code, n: mpHumans().length, max: MPS.people, mode: (MPS.mode === 'race' ? 'Race' : 'Co-op') + (MPS.bots ? ' + ' + MPS.bots + ' bots' : '') }); } catch (e) {} };
    ad(); mpAdT = setInterval(ad, 30000);
}
function mpHost() {
    mpSay('Opening a room...');
    mpHG().then(HG => {
        if (!HG) return mpSay('Multiplayer needs the Huntington Games launcher.', true);
        MPS.name = mpMyName(); const net = HG.create({ game: 'spikes' }); MPS.net = net; mpWire(net);
        net.host({ name: MPS.name, maxPlayers: 10, accept: () => MPS.started ? 'That game has already started.' : (mpHumans().length >= MPS.people ? 'The room is full.' : true) }).then(r => {
            MPS.host = true; MPS.code = r.code; MPS.me = 0; mpSay('Room open. Share the code, or just start with bots.'); mpLobbySend();
        }, e => { mpSay(e.message || 'Could not open a room.', true); MPS.net = null; });
    });
}
function mpJoin(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return mpSay('Type the 6-digit code.', true);
    mpSay('Joining...');
    mpHG().then(HG => {
        if (!HG) return mpSay('Multiplayer needs the Huntington Games launcher.', true);
        MPS.name = mpMyName(); const net = HG.create({ game: 'spikes' }); MPS.net = net; mpWire(net);
        net.join(code, { name: MPS.name }).then(r => { MPS.host = false; MPS.code = r.code || code; MPS.me = r.id; mpSay('In the room. Waiting for the host to start.'); mpPaintLobby(); },
            e => { mpSay(e.message || 'Could not join.', true); MPS.net = null; });
    });
}
function mpMsg(peer, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'lobby' && !MPS.host) { Object.assign(MPS, { roster: m.roster, mode: m.mode, people: m.people, bots: m.bots, startLv: m.startLv, rounds: m.rounds }); mpPaintLobby(); return; }
    if (m.t === 'start' && !MPS.host) return mpBegin(m);
    if (m.t === 's') {
        const o = MPS.others.get(peer.id) || { x: m.x, y: m.y, id: peer.id };
        Object.assign(o, { tx: m.x, ty: m.y, vx: m.vx, g: m.g, dead: !!m.d, fin: !!m.f, l: m.l, name: (MPS.roster.find(r => r.id === peer.id) || {}).name || peer.name });
        MPS.others.set(peer.id, o); return;
    }
    if (m.t === 'b' && !MPS.host) {
        for (const [id, x, y, g, d, f, vx] of m.b) {
            const o = MPS.others.get(id) || { x, y, id };
            Object.assign(o, { tx: x, ty: y, g, vx, dead: !!d, fin: !!f, l: m.l, name: (MPS.roster.find(r => r.id === id) || {}).name || 'Bot' });
            MPS.others.set(id, o);
        }
        return;
    }
    if (m.t === 'fin' && MPS.host && peer.id !== 0) { if (m.l === MPS.level) mpGotFinish(peer.id); return; }
    if (m.t === 'fin' && !MPS.host) { MPS.scores = m.scores; MPS.fin = m.fin; mpBoard(); return; }
    if (m.t === 'died' && MPS.host && MPS.mode === 'coop') { MPS.teamDeaths++; mpBoard(); return; }
    if (m.t === 'round' && !MPS.host) return mpOnRound(m);
}
function mpStart() {
    if (!MPS.host) return;
    MPS.roster = mpLobbyRoster();
    const m = { t: 'start', roster: MPS.roster, mode: MPS.mode, startLv: MPS.startLv, rounds: MPS.rounds, seed: (Math.random() * 1e9) | 0 };
    MPS.net.send('all', m); mpBegin(m);
}
function mpBegin(m) {
    Object.assign(MPS, { on: true, started: true, roster: m.roster, mode: m.mode, startLv: m.startLv, rounds: m.rounds, round: 1, scores: {}, teamDeaths: 0, fin: [] });
    MPS.others.clear(); MPS.bots_.clear();
    totalDeaths = 0; deathDisplay.textContent = 'Deaths: 0';
    mpLoadLevel(m.startLv, m.seed);
    if (MPS.host) for (const r of MPS.roster) if (r.bot) MPS.bots_.set(r.id, mpMakeBot(r.id, r.name));
    enterPlay(); mpBoard();
    showToast(MPS.mode === 'race' ? 'Race! First to the goal scores the most.' : 'Co-op! Everyone has to reach the goal.');
}
function mpLeave() {
    clearInterval(mpAdT);
    try { const p = window.parent; if (p && p !== window && p.HG_partyClose && MPS.code && MPS.host) p.HG_partyClose(MPS.code); } catch (e) {}
    const net = MPS.net; MPS.net = null;
    try { net && net.close(); } catch (e) {}
    Object.assign(MPS, { on: false, host: false, code: '', started: false, between: false, roster: [], fin: [] });
    MPS.others.clear(); MPS.bots_.clear();
    const b = mpEl('mpBoard'); if (b) b.classList.add('hidden');
    if (gameState !== 'MENU' && gameState !== 'EDITOR') showMainMenu();
}

// ---- the lobby screen
function mpPaintLobby() {
    const box = mpEl('mpLobby'); if (!box) return;
    box.classList.toggle('hidden', !MPS.code);
    if (!MPS.code) return;
    mpEl('mpCode').textContent = MPS.code;
    const roster = MPS.host ? mpLobbyRoster() : MPS.roster;
    mpEl('mpPeople').innerHTML = roster.map(r => `<span class="mp-chip"><i style="background:${mpCol(r.id)}"></i>${mpEsc(r.name)}${r.bot ? ' <small>bot</small>' : r.id === 0 ? ' <small>host</small>' : ''}</span>`).join('');
    for (const [id, v] of [['mpMode', MPS.mode], ['mpPeopleN', MPS.people], ['mpBotsN', MPS.bots], ['mpStartLv', MPS.startLv], ['mpRounds', MPS.rounds]]) { const e = mpEl(id); e.value = v; e.disabled = !MPS.host; }
    mpEl('mpStartBtn').classList.toggle('hidden', !MPS.host);
    mpEl('mpWaitNote').classList.toggle('hidden', MPS.host);
}
function openMultiplayer() {
    hideAllScreens(); mpEl('mpScreen').classList.remove('hidden'); gameState = 'MENU';
    const sel = mpEl('mpStartLv'); if (!sel.options.length) for (let i = 1; i <= MAX_LEVELS; i++) sel.add(new Option('Level ' + i, i));
    mpSay(''); mpPaintLobby();
}
(function mpBind() {
    const on = (id, fn) => { const e = mpEl(id); if (e) e.addEventListener('click', fn); };
    on('mpMenuBtn', openMultiplayer);
    on('mpHostBtn', () => { if (!MPS.net) mpHost(); });
    on('mpJoinBtn', () => { if (!MPS.net) mpJoin(mpEl('mpJoinCode').value); });
    on('mpBackBtn', () => { mpLeave(); showMainMenu(); });
    on('mpStartBtn', mpStart);
    on('mpAgainBtn', () => { openMultiplayer(); mpLobbySend(); });
    on('mpResLeaveBtn', () => { mpLeave(); showMainMenu(); });
    const ch = (id, key, num) => { const e = mpEl(id); if (e) e.addEventListener('change', () => { if (!MPS.host) return; MPS[key] = num ? +e.value : e.value; mpLobbySend(); }); };
    ch('mpMode', 'mode'); ch('mpPeopleN', 'people', 1); ch('mpBotsN', 'bots', 1); ch('mpStartLv', 'startLv', 1); ch('mpRounds', 'rounds', 1);
    const jc = mpEl('mpJoinCode'); if (jc) jc.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') mpEl('mpJoinBtn').click(); });
    // leaving from the pause menu ends your multiplayer game
    const gb = goBack; goBack = function () { if (MPS.on) { mpLeave(); return; } gb(); };
    // the launcher: join from an invite / open party / Quick Match, or host for one
    window.__hgJoin = c => { openMultiplayer(); mpEl('mpJoinCode').value = c; if (!MPS.net) mpJoin(c); return true; };
    window.__hgHost = convId => { openMultiplayer(); if (!MPS.net) mpHost(); const iv = setInterval(() => { if (MPS.code) { clearInterval(iv); try { window.parent.HG_sendInvite(convId, { game: 'spikes', code: MPS.code, max: MPS.people }); } catch (e) {} } }, 300); setTimeout(() => clearInterval(iv), 25000); };
    setTimeout(() => { try { const p = window.parent; if (!p || p === window) return; const c = p.HG_takeJoin && p.HG_takeJoin('spikes'); if (c) return window.__hgJoin(c); const h = p.HG_takeHost && p.HG_takeHost('spikes'); if (h && h.convId) window.__hgHost(h.convId); } catch (e) {} }, 400);
    setTimeout(() => { if (window.__spikes) window.__spikes.mp = () => MPS; });
})();
