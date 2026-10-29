// ==========================================
// MEETING UI: player cards, voting, chat
// ==========================================
let MU = { sel: null, cards: [], last: '' };
function openMeeting(m) {
  const g = $('mt-grid'); g.innerHTML = ''; $('mt-log').innerHTML = ''; MU = { sel: null, cards: [], last: '' };
  const caller = G.players[m.c];
  sysLine(m.b >= 0 ? caller.name + ' reported a dead body.' : caller.name + ' called an emergency meeting.');
  for (const p of G.players) {
    const d = document.createElement('div'); d.className = 'pc'; const ic = mkIcon(p.color, 36, !p.alive); d.appendChild(ic);
    const n = document.createElement('b'); n.textContent = p.name; d.appendChild(n); const bd = document.createElement('div'); bd.className = 'bd'; d.appendChild(bd);
    const cf = document.createElement('div'); cf.className = 'cf hidden'; const y = document.createElement('button'); y.className = 'y'; y.textContent = '✓'; const no = document.createElement('button'); no.className = 'n'; no.textContent = '✕'; cf.appendChild(y); cf.appendChild(no); d.appendChild(cf);
    d.onclick = () => { if (canVote() && p.alive && !p.left && p.id !== G.me) { MU.sel = p.id; meetUpdate(); } };
    y.onclick = e => { e.stopPropagation(); castVote(p.id); }; no.onclick = e => { e.stopPropagation(); MU.sel = null; meetUpdate(); };
    g.appendChild(d); MU.cards[p.id] = { d, bd, cf, ic, n };
  }
  $('mt-skip').onclick = () => { if (!canVote()) return; if (MU.sel === -1) castVote(-1); else { MU.sel = -1; meetUpdate(); } };
  $('mt-note').textContent = me() && !me().alive ? 'You are dead: only other ghosts see your messages, and you cannot vote.' : (G.me < 0 ? 'Spectating: you cannot talk.' : '');
  meetUpdate();
}
function canVote() { const p = me(); return !!(p && p.alive && G.meet && G.meet.st === 'vote' && !G.meet.voted.has(p.id)); }
function castVote(v) { if (!canVote()) return; MU.sel = null; act({ t: 'vote', v }); sfx.vote(); if (!NET.guest) { /* host: event arrives through emit */ } else { G.meet.voted.add(G.me); meetUpdate(); } }
function sysLine(text) { const d = document.createElement('div'); d.className = 'sy'; d.textContent = text; $('mt-log').appendChild(d); $('mt-log').scrollTop = 1e6; }
function chatLine(m) {
  const p = G.players[m.p]; if (!p) return; const d = document.createElement('div'); if (m.g) d.className = 'g';
  const s = document.createElement('b'); s.textContent = (m.g ? '[ghost] ' : '') + p.name + ': '; s.style.color = COLORS[p.color].c === '#3b4455' ? '#8fa0bf' : COLORS[p.color].c;
  d.appendChild(s); d.appendChild(document.createTextNode(m.m)); const L = $('mt-log'); L.appendChild(d); L.scrollTop = 1e6;
}
function meetUpdate(timerOnly) {
  const m = G.meet; if (!m) return;
  const t = Math.max(0, Math.ceil(m.t)), label = m.st === 'discuss' ? 'Discussion' : m.st === 'vote' ? 'Voting' : 'Results';
  const txt = label + '  ' + t + 's'; if (MU.last !== txt) { MU.last = txt; $('mt-time').textContent = txt; $('mt-title').textContent = m.st === 'result' ? 'Votes are in' : 'Who is the Imposter?'; }
  if (timerOnly === true) return;
  const voting = canVote(), res = m.st === 'result';
  for (const p of G.players) {
    const c = MU.cards[p.id]; if (!c) continue; c.d.classList.toggle('dead', !p.alive || p.left); c.d.classList.toggle('sel', MU.sel === p.id); c.d.classList.toggle('me', p.id === G.me);
    c.cf.classList.toggle('hidden', !(voting && MU.sel === p.id)); c.bd.innerHTML = '';
    if (m.caller === p.id && m.body >= 0) { const s = document.createElement('span'); s.textContent = '⚠'; s.title = 'Reported the body'; c.bd.appendChild(s); }
    if (p.left) { const s = document.createElement('span'); s.textContent = 'left'; c.bd.appendChild(s); }
    if (!res && m.voted.has(p.id)) { const s = document.createElement('span'); s.textContent = '✔'; s.style.color = '#4dff9a'; c.bd.appendChild(s); }
    if (res) for (const k in m.votes) if (m.votes[k] === p.id) { const i = document.createElement('i'); i.style.background = COLORS[G.players[k].color].c; c.bd.appendChild(i); }
  }
  const sk = $('mt-skip'); sk.disabled = !voting; sk.textContent = MU.sel === -1 ? 'Confirm skip' : 'Skip vote';
  const sv = $('mt-skipv'); sv.innerHTML = ''; if (res) for (const k in m.votes) if (m.votes[k] < 0) { const i = document.createElement('i'); i.style.background = COLORS[G.players[k].color].c; sv.appendChild(i); }
  if (G.me >= 0 && m.voted.has(G.me) && m.st === 'vote') sk.textContent = 'Vote cast';
  const inp = $('mt-input'), can = G.me >= 0 && m.st !== 'result'; inp.disabled = !can; $('mt-send').disabled = !can;
}
function sendChat() { const i = $('mt-input'), v = i.value.trim(); if (!v || !G || G.me < 0) return; i.value = ''; act({ t: 'chat', m: v }); }
function closeMeeting() { $('meet').classList.add('hidden'); MU = { sel: null, cards: [], last: '' }; }
function bindMeeting() {
  $('mt-send').onclick = sendChat; $('mt-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } e.stopPropagation(); });
}
