// ==========================================
// TIC-TAC-TOE: three in a row. Best of five rounds against a friend or the bot (who is good, not perfect).
// ==========================================
const T3 = { b: Array(9).fill(-1), turn: 0, ids: [0, 0], over: false, line: null, wins: [0, 0], round: 0, first: 0 };
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
document.getElementById('app').innerHTML = '<div class="mg-hud"><span id="t3-a"></span><span id="t3-t"></span><span id="t3-b"></span></div><div id="t3"></div>';
const box = document.getElementById('t3');
box.innerHTML = Array.from({ length: 9 }, (_, i) => `<button class="t3c" data-i="${i}"></button>`).join('');
const winner = b => { for (const l of LINES) if (b[l[0]] >= 0 && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return l; return null; };
function mmT(b, who, me) {
    const w = winner(b); if (w) return [b[w[0]] === me ? 10 : -10, -1];
    const free = b.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0); if (!free.length) return [0, -1];
    let best = who === me ? -99 : 99, bi = free[0];
    for (const i of free) { b[i] = who; const v = mmT(b, 1 - who, me)[0] * 0.9; b[i] = -1; if (who === me ? v > best : v < best) { best = v; bi = i; } }
    return [best, bi];
}
function botPick(side) { const free = T3.b.map((v, i) => v < 0 ? i : -1).filter(i => i >= 0); if (Math.random() < 0.18) return free[Math.floor(Math.random() * free.length)]; return mmT(T3.b.slice(), side, side)[1]; }
function hostMove(from, i) {
    if (T3.over) return; const side = T3.ids.indexOf(from); if (side !== T3.turn || T3.b[i] >= 0) return;
    T3.b[i] = side; const line = winner(T3.b), full = T3.b.every(v => v >= 0);
    T3.line = line; T3.over = !!line || full;
    if (line) T3.wins[side]++; if (!T3.over) T3.turn = 1 - T3.turn;
    const m = { k: 'st', b: T3.b, turn: T3.turn, line, over: T3.over, wins: T3.wins, round: T3.round }; MG.toAll(m); onState(m);
    if (T3.over) setTimeout(() => {
        const done = T3.wins[0] >= 3 || T3.wins[1] >= 3 || T3.round >= 5;
        if (done) { const a = MG.player(T3.ids[0]), b = MG.player(T3.ids[1]), w = T3.wins[0] === T3.wins[1] ? null : T3.wins[0] > T3.wins[1] ? a : b;
            MG.end(`<h1>${w ? mgEsc(w.name) + ' wins!' : 'A draw'}</h1><div class="mg-res-row"><span>✕ ${mgEsc(a.name)}</span><b>${T3.wins[0]}</b></div><div class="mg-res-row"><span>◯ ${mgEsc(b.name)}</span><b>${T3.wins[1]}</b></div>`); }
        else newRound();
    }, 1400);
    else botTurn();
}
function newRound() { T3.round++; T3.b = Array(9).fill(-1); T3.first = 1 - T3.first; T3.turn = T3.first; T3.over = false; T3.line = null;
    const m = { k: 'st', b: T3.b, turn: T3.turn, line: null, over: false, wins: T3.wins, round: T3.round }; MG.toAll(m); onState(m); botTurn(); }
function botTurn() { const p = MG.player(T3.ids[T3.turn]); if (p && p.bot && !T3.over) setTimeout(() => hostMove(p.id, botPick(T3.turn)), 450 + Math.random() * 400); }
function onState(m) {
    Object.assign(T3, { b: m.b, turn: m.turn, line: m.line, over: m.over, wins: m.wins, round: m.round });
    box.querySelectorAll('.t3c').forEach((el, i) => { el.textContent = m.b[i] < 0 ? '' : m.b[i] ? '◯' : '✕'; el.className = 't3c' + (m.b[i] >= 0 ? ' p' + m.b[i] : '') + (m.line && m.line.includes(i) ? ' win' : ''); });
    const a = MG.player(T3.ids[0]), b = MG.player(T3.ids[1]), t = MG.player(T3.ids[T3.turn]);
    document.getElementById('t3-a').textContent = '✕ ' + (a ? a.name : '') + ' · ' + m.wins[0]; document.getElementById('t3-b').textContent = '◯ ' + (b ? b.name : '') + ' · ' + m.wins[1];
    document.getElementById('t3-t').textContent = m.over ? (m.line ? 'Round to ' + (MG.player(T3.ids[m.b[m.line[0]]]) || {}).name : 'Draw round') : 'Round ' + m.round + ' of 5 · ' + (T3.ids[T3.turn] === MG.me ? 'your turn' : (t ? t.name + '’s turn' : ''));
    MGS.blip(); if (m.line) (T3.ids[m.b[m.line[0]]] === MG.me ? MGS.win : MGS.lose)();
}
box.addEventListener('click', e => { const c = e.target.closest('.t3c'); if (c && T3.ids[T3.turn] === MG.me && !T3.over) MG.toHost({ k: 'mv', i: +c.dataset.i }); });
MG.init({
    id: 'mg-tictactoe', title: 'Tic-Tac-Toe', color: '#2dd4bf', min: 2, max: 2, bots: 1, defBots: 1,
    sub: 'Three in a row. First to win 3 rounds.', howto: 'Click a square on your turn. Rounds alternate who starts; first to 3 round wins takes it (best of 5).',
    onStart(roster) { T3.ids = [roster[0].id, roster[1].id]; T3.wins = [0, 0]; T3.round = 0; T3.first = Math.random() < 0.5 ? 1 : 0; if (MG.isHost()) newRound(); },
    onMsg(from, m) { if (m.k === 'mv' && MG.isHost()) hostMove(from, m.i); else if (m.k === 'st' && !MG.isHost()) onState(m); },
    onLeave() { if (!T3.over && MG.isHost()) { T3.over = true; MG.end('<h1>Your opponent left</h1>'); } }
});
