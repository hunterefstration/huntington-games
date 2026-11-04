// ==========================================
// REACTION DUEL: wait for green, then tap faster than everyone else. Tap early and you sit the round out.
// First to 5 points. The host runs the rounds and the bots (who react in 0.2-0.45 s).
// ==========================================
const R = { scores: {}, round: 0, phase: 'idle', goAt: 0, myState: '', last: null, taps: {}, timers: [] };
const WIN = 5;
document.getElementById('app').innerHTML = `<div id="rd"><div id="rd-big">Get ready</div><div id="rd-small"></div><div id="rd-board"></div></div>`;
const rdBig = document.getElementById('rd-big'), rdSmall = document.getElementById('rd-small'), rdBoard = document.getElementById('rd-board'), rdBox = document.getElementById('rd');
function rdPaint(state, big, small) { rdBox.className = state; rdBig.textContent = big; rdSmall.textContent = small || ''; }
function rdBoardPaint() {
    rdBoard.innerHTML = MG.roster.map(p => `<div class="rd-p"><i style="background:${p.col}"></i>${mgEsc(p.name)}<b>${'●'.repeat(R.scores[p.id] || 0)}${'○'.repeat(WIN - (R.scores[p.id] || 0))}</b>${R.last && R.last.ms[p.id] != null ? `<span>${R.last.ms[p.id] < 0 ? 'too soon' : R.last.ms[p.id] + ' ms'}</span>` : ''}</div>`).join('');
}
function rdClear() { R.timers.forEach(clearTimeout); R.timers = []; }
// ---- host: the rounds
function rdNextRound() {
    R.round++; R.taps = {}; const round = R.round;
    MG.toAll({ k: 'ready', round }); rdOnMsg(MG.me, { k: 'ready', round });
    const wait = 1500 + Math.random() * 3200;
    R.timers.push(setTimeout(() => {
        MG.toAll({ k: 'go', round }); rdOnMsg(MG.me, { k: 'go', round });
        for (const p of MG.roster) if (p.bot) R.timers.push(setTimeout(() => rdHostTap(p.id, round, 200 + Math.round(Math.random() * 250)), 200 + Math.random() * 250));
        R.timers.push(setTimeout(() => rdHostResolve(round), 2500));
    }, wait));
}
function rdHostTap(id, round, ms) {
    if (round !== R.round || R.taps[id] != null) return;
    R.taps[id] = ms;
    if (MG.roster.every(p => R.taps[p.id] != null)) rdHostResolve(round);
}
function rdHostResolve(round) {
    if (round !== R.round || R.phase === 'result') return;
    R.phase = 'result';
    let best = null; for (const p of MG.roster) { const ms = R.taps[p.id]; if (ms != null && ms >= 0 && (best == null || ms < R.taps[best])) best = p.id; }
    if (best != null) R.scores[best] = (R.scores[best] || 0) + 1;
    const m = { k: 'result', round, ms: R.taps, winner: best, scores: R.scores };
    MG.toAll(m); rdOnMsg(MG.me, m);
    const champ = MG.roster.find(p => (R.scores[p.id] || 0) >= WIN);
    R.timers.push(setTimeout(() => {
        if (champ) {
            const rows = MG.roster.slice().sort((a, b) => (R.scores[b.id] || 0) - (R.scores[a.id] || 0));
            MG.end(`<h1>${mgEsc(champ.name)} wins!</h1>` + rows.map((p, i) => `<div class="mg-res-row"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${mgEsc(p.name)}</span><b>${R.scores[p.id] || 0}</b></div>`).join(''));
        } else rdNextRound();
    }, 2200));
}
// ---- everyone: what the screen shows
function rdOnMsg(from, m) {
    if (MG.isHost() && m.k === 'tap') return rdHostTap(from, m.round, m.ms);
    if (MG.isHost() && m.k === 'early') return rdHostTap(from, m.round, -1);
    if (m.k === 'ready') { R.round = m.round; R.phase = 'wait'; R.myState = ''; rdPaint('wait', 'Wait for green...', 'Round ' + m.round + ' · tap too soon and you sit this one out'); rdBoardPaint(); }
    else if (m.k === 'go') { if (R.myState === 'early') return; R.phase = 'go'; R.goAt = performance.now(); rdPaint('go', 'TAP!', ''); MGS.go(); }
    else if (m.k === 'result') {
        R.phase = 'result'; R.scores = m.scores; R.last = m; rdBoardPaint();
        const w = MG.player(m.winner);
        rdPaint('result', w ? (m.winner === MG.me ? 'You got it!' : w.name + ' got it') : 'Nobody!', w && m.ms[m.winner] != null ? m.ms[m.winner] + ' ms' : '');
        if (m.winner === MG.me) MGS.win(); else MGS.blip();
    }
}
function rdTap() {
    if (R.phase === 'wait' && !R.myState) { R.myState = 'early'; rdPaint('early', 'Too soon!', 'Wait for green next time'); MGS.hit(); MG.toHost({ k: 'early', round: R.round }); }
    else if (R.phase === 'go' && !R.myState) { R.myState = 'tapped'; const ms = Math.round(performance.now() - R.goAt); rdPaint('tapped', ms + ' ms', 'Waiting for the others...'); MG.toHost({ k: 'tap', round: R.round, ms }); }
}
rdBox.addEventListener('pointerdown', e => { e.preventDefault(); rdTap(); });
addEventListener('keydown', e => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && !e.target.closest('input')) { e.preventDefault(); rdTap(); } });
MG.init({
    id: 'mg-reaction', title: 'Reaction Duel', color: '#22c55e', min: 2, max: 8, bots: 7, defBots: 3,
    sub: 'Wait for green, then tap faster than everyone.', howto: 'Click, tap or press <b>Space</b> the instant the screen turns green. Too soon and you sit the round out. First to 5 wins.',
    onStart(roster) { rdClear(); R.scores = {}; R.round = 0; R.last = null; rdBoardPaint(); rdPaint('wait', 'Get ready', ''); if (MG.isHost()) R.timers.push(setTimeout(rdNextRound, 1200)); },
    onMsg: rdOnMsg, onLeave(id) { MG.roster = MG.roster.filter(p => p.id !== id); rdBoardPaint(); }, onQuit() { rdClear(); }, onEnd() { rdClear(); }
});
