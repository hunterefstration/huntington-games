// ==========================================
// CONNECT FOUR: drop discs, four in a row wins (across, down or diagonal). Two players, or you against the bot.
// The host keeps the board and checks every move. The bot looks four moves ahead (and is not perfect on purpose).
// ==========================================
const C = 7, Rw = 6;
const G4 = { b: [], turn: 0, ids: [0, 0], over: false, last: -1, hover: -1, anim: null, wins: null };
document.getElementById('app').innerHTML = '<div class="mg-hud"><span id="c4-a"></span><span id="c4-t"></span><span id="c4-b"></span></div><canvas id="c4"></canvas>';
const cv = document.getElementById('c4'), x = cv.getContext('2d'), S = 80, Wd = C * S, Ht = (Rw + 1) * S;
function fit() { const k = Math.min(innerWidth / Wd, (innerHeight - 50) / Ht) * 0.95; cv.width = Wd; cv.height = Ht; cv.style.width = Wd * k + 'px'; cv.style.height = Ht * k + 'px'; cv.style.margin = '46px auto 0'; }
addEventListener('resize', fit); fit();
const fresh = () => Array.from({ length: Rw }, () => Array(C).fill(-1));
function dropRow(b, c) { for (let r = Rw - 1; r >= 0; r--) if (b[r][c] < 0) return r; return -1; }
function lineAt(b, r, c) {
    const p = b[r][c]; if (p < 0) return null;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [[r, c]];
        for (const s of [1, -1]) for (let k = 1; k < 4; k++) { const rr = r + dr * k * s, cc = c + dc * k * s; if (rr < 0 || rr >= Rw || cc < 0 || cc >= C || b[rr][cc] !== p) break; cells.push([rr, cc]); }
        if (cells.length >= 4) return cells;
    }
    return null;
}
// ---- the bot: minimax, 4 plies, with a simple window score
function score(b, me) {
    let s = 0; const opp = 1 - me;
    for (let r = 0; r < Rw; r++) if (b[r][3] === me) s += 3;
    const win = (cells) => { let m = 0, o = 0; for (const [r, c] of cells) { if (b[r][c] === me) m++; else if (b[r][c] === opp) o++; } if (m && o) return 0; return m === 3 ? 5 : m === 2 ? 2 : o === 3 ? -6 : o === 2 ? -2 : 0; };
    for (let r = 0; r < Rw; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = []; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= Rw || cc < 0 || cc >= C) break; cells.push([rr, cc]); }
        if (cells.length === 4) s += win(cells);
    }
    return s;
}
function mm(b, depth, who, me, a, bb) {
    const moves = [3, 2, 4, 1, 5, 0, 6].filter(c => dropRow(b, c) >= 0);
    if (!moves.length || depth === 0) return [score(b, me), -1];
    let best = who === me ? -1e9 : 1e9, bestC = moves[0];
    for (const c of moves) {
        const r = dropRow(b, c); b[r][c] = who;
        let v; if (lineAt(b, r, c)) v = who === me ? 1e6 + depth : -1e6 - depth; else v = mm(b, depth - 1, 1 - who, me, a, bb)[0];
        b[r][c] = -1;
        if (who === me ? v > best : v < best) { best = v; bestC = c; }
        if (who === me) a = Math.max(a, v); else bb = Math.min(bb, v); if (bb <= a) break;
    }
    return [best, bestC];
}
function botMove(side) { const b = G4.b.map(r => r.slice()); if (Math.random() < 0.12) { const ok = [0, 1, 2, 3, 4, 5, 6].filter(c => dropRow(b, c) >= 0); return ok[Math.floor(Math.random() * ok.length)]; } return mm(b, 4, side, side, -1e9, 1e9)[1]; }
// ---- the host applies moves
function hostMove(from, c) {
    if (G4.over) return; const side = G4.ids.indexOf(from); if (side !== G4.turn) return;
    const r = dropRow(G4.b, c); if (r < 0) return;
    G4.b[r][c] = side; G4.last = c;
    const line = lineAt(G4.b, r, c), full = G4.b[0].every(v => v >= 0);
    G4.wins = line; G4.over = !!line || full; if (!G4.over) G4.turn = 1 - G4.turn;
    const m = { k: 'st', b: G4.b, turn: G4.turn, last: c, row: r, wins: line, over: G4.over, draw: !line && full };
    MG.toAll(m); onState(m);
    if (G4.over) setTimeout(() => { const w = line ? MG.player(G4.ids[side]) : null; MG.end(w ? `<h1>${mgEsc(w.name)} wins!</h1><p class="mg-sub">Four in a row.</p>` : '<h1>A draw</h1><p class="mg-sub">The board is full.</p>'); }, 1600);
    else botTurn();
}
function botTurn() { const p = MG.player(G4.ids[G4.turn]); if (p && p.bot && !G4.over) setTimeout(() => hostMove(p.id, botMove(G4.turn)), 500 + Math.random() * 500); }
function onState(m) { G4.b = m.b; G4.turn = m.turn; G4.over = m.over; G4.wins = m.wins; G4.anim = { c: m.last, r: m.row, y: 0, t: 0 }; MGS.blip(); hud(); if (m.over) (m.wins && G4.ids[G4.b[m.row][m.last]] === MG.me ? MGS.win : MGS.lose)(); }
function hud() {
    const a = MG.player(G4.ids[0]), b = MG.player(G4.ids[1]);
    document.getElementById('c4-a').innerHTML = `<i style="color:#f43f5e">●</i> ${mgEsc(a ? a.name : '')}`; document.getElementById('c4-b').innerHTML = `<i style="color:#facc15">●</i> ${mgEsc(b ? b.name : '')}`;
    const t = MG.player(G4.ids[G4.turn]); document.getElementById('c4-t').textContent = G4.over ? 'Game over' : (G4.ids[G4.turn] === MG.me ? 'Your turn' : (t ? t.name + '’s turn' : ''));
}
cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); G4.hover = Math.floor((e.clientX - r.left) / r.width * C); });
cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(), c = Math.floor((e.clientX - r.left) / r.width * C); if (G4.ids[G4.turn] === MG.me && !G4.over) MG.toHost({ k: 'drop', c }); });
addEventListener('keydown', e => { const n = +e.key; if (n >= 1 && n <= 7 && G4.ids[G4.turn] === MG.me && !G4.over) MG.toHost({ k: 'drop', c: n - 1 }); });
function draw(t) {
    requestAnimationFrame(draw);
    x.fillStyle = '#0b1026'; x.fillRect(0, 0, Wd, Ht);
    if (G4.ids[G4.turn] === MG.me && !G4.over && G4.hover >= 0) { x.fillStyle = G4.turn ? '#facc15' : '#f43f5e'; x.globalAlpha = 0.6; x.beginPath(); x.arc(G4.hover * S + S / 2, S / 2, S * 0.38, 0, 7); x.fill(); x.globalAlpha = 1; }
    x.fillStyle = '#1d4ed8'; x.fillRect(0, S, Wd, Rw * S);
    for (let r = 0; r < Rw; r++) for (let c = 0; c < C; c++) {
        const v = G4.b[r] ? G4.b[r][c] : -1, cx = c * S + S / 2; let cy = (r + 1) * S + S / 2;
        if (G4.anim && G4.anim.c === c && G4.anim.r === r) { G4.anim.t = Math.min(1, G4.anim.t + 0.08); cy = S / 2 + (cy - S / 2) * (G4.anim.t * G4.anim.t); }
        x.fillStyle = v < 0 ? '#0b1026' : v ? '#facc15' : '#f43f5e'; x.beginPath(); x.arc(cx, cy, S * 0.38, 0, 7); x.fill();
        if (v >= 0) { x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(cx - 8, cy - 8, S * 0.12, 0, 7); x.fill(); }
    }
    if (G4.wins) { x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); G4.wins.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]).forEach(([r, c], i) => { const px = c * S + S / 2, py = (r + 1) * S + S / 2; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }
}
requestAnimationFrame(draw);
MG.init({
    id: 'mg-connect4', title: 'Connect Four', color: '#f43f5e', min: 2, max: 2, bots: 1, defBots: 1,
    sub: 'Four in a row wins.', howto: 'Click a column (or press <b>1-7</b>) to drop your disc. Get four in a row across, down or diagonally.',
    onStart(roster) { G4.ids = [roster[0].id, roster[1].id]; G4.b = fresh(); G4.turn = Math.random() < 0.5 ? 0 : 1; G4.over = false; G4.wins = null; G4.anim = null;
        if (MG.isHost()) { const m = { k: 'start', turn: G4.turn }; MG.toAll(m); } hud(); if (MG.isHost()) botTurn(); },
    onMsg(from, m) { if (m.k === 'drop' && MG.isHost()) hostMove(from, m.c); else if (m.k === 'st') onState(m); else if (m.k === 'start') { G4.turn = m.turn; hud(); } },
    onLeave() { if (!G4.over && MG.isHost()) { G4.over = true; MG.end('<h1>Your opponent left</h1>'); } }
});
