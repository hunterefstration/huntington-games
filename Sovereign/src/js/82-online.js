// ==========================================
// SOVEREIGN ONLINE: 2-6 leaders in the same world (HGNet rooms with 6-digit codes, through the launcher).
// Everyone starts the same world (same seed) as a different country and runs their own government.
// - Time: the host's clock rules. Guests follow the host's speed and pauses, catching up or waiting as needed.
// - Each month every leader sends their own country to the others, so you always see the real state of the other
//   players' countries (on the map, in Diplomacy and in the Leaders board). The AI never plays a human's country.
// - Wars between players are run by the host's game and sent to everyone; peace between players is a ceasefire
//   offer the other leader accepts or refuses. Wars against AI countries stay your own business.
// - Leaders board and chat at the top.
// ==========================================
const Online = {
  on: false, net: null, host: false, code: '', id: 0, name: '', picks: {}, names: {}, started: false, lastClk: 0, hostClk: null,
  hgnet() {
    const h = window.HGNet || (() => { try { return window.parent && window.parent.HGNet; } catch (e) { return null; } })();
    if (h) return Promise.resolve(h);
    return new Promise(res => { const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js'; s.onload = () => res(window.HGNet || null); s.onerror = () => res(null); document.head.appendChild(s); });
  },
  myName() { try { const L = window.parent && window.parent.HGGrapevine, me = L && L.me(); if (me) return me.name; } catch (e) {} return Store.get('onlineName', 'Leader ' + (100 + Math.floor(Math.random() * 900))); },
  countries() { return World.countries.filter(c => c && World.nat0[c.idx]).sort((a, b) => (World.nat0[b.idx].real || 0) - (World.nat0[a.idx].real || 0)); },
  // ---- lobby
  open() {
    UI.modal(`<h2>🌐 Play online</h2><p class="sub">2 to 6 leaders in the same world, each running a different country. Your friends need the 6-digit code.</p>
      <div class="btnrow"><button class="btn gold" id="on-host">Open a room</button><input id="on-code" maxlength="7" placeholder="6-digit code" style="width:130px;text-align:center;font-weight:700;letter-spacing:.15em;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:7px"><button class="btn" id="on-join">Join</button></div>
      <div id="on-st" class="sub" style="min-height:20px;margin:8px 0"></div><div id="on-lobby"></div>
      <div class="btnrow"><button class="btn" id="on-close">Close</button></div>`);
    $('#on-host').onclick = () => this.hostRoom();
    $('#on-join').onclick = () => this.joinRoom($('#on-code').value);
    $('#on-code').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') this.joinRoom($('#on-code').value); };
    $('#on-close').onclick = () => { if (!this.started) this.leave(); UI.closeModal(); };
    this.paint();
  },
  st(t, bad) { const e = $('#on-st'); if (e) { e.textContent = t; e.style.color = bad ? '#ff8a7a' : ''; } },
  wire(net) {
    net.on('message', (p, m) => this.msg(p, m));
    net.on('join', () => { if (this.host) this.lobbySend(); });
    net.on('leave', p => { delete this.picks[p.id]; delete this.names[p.id]; if (G && G.online) for (const k in G.online.humans) if (G.online.humans[k].id === p.id) { toast(G.online.humans[k].name + ' left the game. The AI takes over ' + World.countries[k].name + '.'); delete G.online.humans[k]; } if (this.host) this.lobbySend(); this.paint(); });
    net.on('closed', (r, t) => { if (this.net !== net) return; const was = this.started; this.reset(); if (was) toast(r === 'host-left' ? 'The host left: you keep playing on your own.' : 'Disconnected: you keep playing on your own.'); else this.st('Disconnected' + (t ? ': ' + t : ''), true); });
  },
  hostRoom() {
    if (this.net) return; this.st('Opening a room...');
    this.hgnet().then(HG => {
      if (!HG) return this.st('Online play needs the Huntington Games launcher.', true);
      this.name = this.myName(); const net = this.net = HG.create({ game: 'sovereign' }); this.wire(net);
      net.host({ name: this.name, maxPlayers: 6, accept: () => this.started ? 'That game has already started.' : true }).then(r => {
        this.host = true; this.code = r.code; this.id = 0; this.names[0] = this.name; this.st('Room open. Pick your country, then start when everyone is in.'); this.lobbySend(); this.advertise();
      }, e => { this.net = null; this.st(e.message || 'Could not open a room.', true); });
    });
  },
  joinRoom(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return this.st('Type the 6-digit code.', true);
    if (this.net) return; this.st('Joining...');
    this.hgnet().then(HG => {
      if (!HG) return this.st('Online play needs the Huntington Games launcher.', true);
      this.name = this.myName(); const net = this.net = HG.create({ game: 'sovereign' }); this.wire(net);
      net.join(code, { name: this.name }).then(r => { this.host = false; this.code = r.code || code; this.id = r.id; this.st('In the room. Pick your country and wait for the host to start.'); this.paint(); },
        e => { this.net = null; this.st(e.message || 'Could not join.', true); });
    });
  },
  advertise() {
    clearInterval(this.adT);
    const ad = () => { try { const p = window.parent; if (p && p !== window && p.HG_partyOpen && this.host && !this.started) p.HG_partyOpen({ game: 'sovereign', code: this.code, n: Object.keys(this.names).length, max: 6, mode: 'World leaders' }); } catch (e) {} };
    ad(); this.adT = setInterval(ad, 30000);
  },
  lobbySend() {
    if (!this.host || !this.net) return;
    for (const p of this.net.peers()) if (!p.isHost && p.state !== 'left') this.names[p.id] = String(p.name || 'Leader').slice(0, 20);
    this.net.send('all', { t: 'lobby', picks: this.picks, names: this.names }); this.paint();
  },
  paint() {
    const el = $('#on-lobby'); if (!el) return;
    if (!this.code) { el.innerHTML = ''; return; }
    const taken = new Set(Object.entries(this.picks).filter(([id]) => +id !== this.id).map(([, i]) => i)), mine = this.picks[this.id];
    el.innerHTML = `<div class="note-box">Room code <b style="font-size:20px;letter-spacing:.15em">${this.code}</b></div>
      <div class="field"><label>Your country</label><select id="on-pick" style="background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px;width:100%">
        <option value="">Choose...</option>${this.countries().filter(c => !taken.has(c.idx)).map(c => `<option value="${c.idx}" ${mine === c.idx ? 'selected' : ''}>${c.flag} ${esc(c.name)}</option>`).join('')}</select></div>
      ${Object.entries(this.names).map(([id, n]) => { const i = this.picks[id]; return `<div class="sumrow"><span>${esc(n)}${+id === 0 ? ' (host)' : ''}${+id === this.id ? ' (you)' : ''}</span><span>${i != null ? World.countries[i].flag + ' ' + esc(World.countries[i].name) : '<i>choosing...</i>'}</span></div>`; }).join('')}
      ${this.host ? `<div class="btnrow"><button class="btn gold" id="on-start">Start the game</button></div>` : '<div class="sub">The host starts the game.</div>'}`;
    $('#on-pick').onchange = e => { const v = e.target.value === '' ? null : +e.target.value; if (this.host) { if (v == null) delete this.picks[0]; else this.picks[0] = v; this.lobbySend(); } else this.net.send('host', { t: 'pick', idx: v }); };
    const sb = $('#on-start'); if (sb) sb.onclick = () => this.start();
  },
  start() {
    const ids = Object.keys(this.names);
    if (ids.some(id => this.picks[id] == null)) return this.st('Everyone has to pick a country first.', true);
    const m = { t: 'start', seed: (Math.random() * 2 ** 31) | 0, picks: this.picks, names: this.names };
    this.net.send('all', m); this.begin(m);
  },
  begin(m) {
    this.started = true; clearInterval(this.adT);
    try { const p = window.parent; if (p && p !== window && p.HG_partyClose && this.host) p.HG_partyClose(this.code); } catch (e) {}
    const idx = m.picks[this.id], n0 = World.nat0[idx];
    newGame({ seed: m.seed, idx, name: n0.leader, title: n0.title, party: 'Governing party', econ: 0, social: 0, traits: [], face: faceFromName(n0.leader), real: true });
    const humans = {}; for (const id in m.picks) humans[m.picks[id]] = { id: +id, name: m.names[id] };
    G.online = { humans, host: this.host, code: this.code };
    UI.closeModal(); Game.start();
    this.on = true;
    inbox('info', 'Online game', 'You lead ' + World.countries[idx].name + '. The other leaders: ' + Object.entries(humans).filter(([i]) => +i !== idx).map(([i, h]) => h.name + ' (' + World.countries[i].name + ')').join(', ') + '. ' + (this.host ? 'You control the clock.' : 'The host controls the clock.') + ' Open Leaders at the top to compare countries and chat.');
    Game.refresh();
  },
  reset() {
    clearInterval(this.adT);
    const net = this.net; this.net = null; try { net && net.close(); } catch (e) {}
    Object.assign(this, { on: false, host: false, code: '', id: 0, picks: {}, names: {}, started: false, hostClk: null });
    if (G) G.online = null;
  },
  leave() { this.reset(); },
  // ---- messages
  msg(peer, m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'lobby': if (!this.host) { this.picks = m.picks; this.names = m.names; this.paint(); } return;
      case 'pick': if (this.host) { if (m.idx == null || Object.entries(this.picks).some(([id, i]) => i === m.idx && +id !== peer.id)) delete this.picks[peer.id]; else this.picks[peer.id] = +m.idx; this.lobbySend(); } return;
      case 'start': if (!this.host) this.begin(m); return;
    }
    if (!this.on || !G || !G.online) return;
    switch (m.t) {
      case 'clk': this.hostClk = m; return;
      case 'nat': {          // another leader's country, as it is in their game
        if (m.idx === G.player.idx || !G.online.humans[m.idx]) return;
        const n = G.nations[m.idx]; if (n && m.n) { for (const k in m.n) n[k] = m.n[k]; }
        return;
      }
      case 'declare': if (this.host) this.hostWar(m.a, m.d, m.goal); return;
      case 'warStart': if (!this.host) { const w = startWar(m.a, m.d, m.goal); if (w) w.hh = true; this.warNote(m.a, m.d); } return;
      case 'wars': if (!this.host) for (const r of m.list) { const w = G.wars.find(x => x.hh && x.a[0] === r.a[0] && x.d[0] === r.d[0]); if (w) { const id = w.id; Object.assign(w, r); w.id = id; } } return;
      case 'warEnd': if (!this.host) { const w = G.wars.find(x => x.hh && x.a[0] === m.a && x.d[0] === m.d); if (w) { w.goal = m.goal; w.hhEnding = true; endWar(w, m.winner, m.how); } } return;
      case 'peaceAsk': if (m.to === G.player.idx) {
        const from = World.countries[m.from];
        UI.confirm('Ceasefire offer from ' + from.name, G.online.humans[m.from].name + ' (' + from.name + ') offers a ceasefire on the current lines. Accept?', 'Accept the ceasefire', () => this.net.send('host', { t: 'peaceYes', a: m.a, d: m.d }) || (this.host && this.msg({ id: 0 }, { t: 'peaceYes', a: m.a, d: m.d })));
      } return;
      case 'peaceYes': if (this.host) { const w = G.wars.find(x => x.hh && x.a[0] === m.a && x.d[0] === m.d); if (w) endWar(w, 'white', 'talks'); } return;
      case 'chat': { const t = String(m.text || '').slice(0, 200); this.chatLog.push({ name: m.name, text: t, day: G.day }); if (this.chatLog.length > 60) this.chatLog.shift(); toast('💬 ' + m.name + ': ' + t); this.paintBoard(); return; }
    }
  },
  chatLog: [],
  // ---- wars between players (the host's game runs them)
  declare(t, goal) {
    const me = G.player.idx, n = G.nations[me];
    if (n.pc < 10) return 'Not enough political capital (10).';
    if (G.wars.some(w => (w.a.includes(me) && w.d.includes(t)) || (w.a.includes(t) && w.d.includes(me)))) return 'Already at war.';
    n.pc -= 10;
    if (this.host) this.hostWar(me, t, goal); else this.net.send('host', { t: 'declare', a: me, d: t, goal });
    return 'War declared on ' + World.countries[t].name + ' (' + G.online.humans[t].name + ')!';
  },
  hostWar(a, d, goal) {
    const w = startWar(a, d, goal); if (!w) return; w.hh = true;
    this.net.send('all', { t: 'warStart', a, d, goal }); this.warNote(a, d);
  },
  warNote(a, d) { newsWorld('⚔ ' + G.online.humans[a].name + ' (' + World.countries[a].name + ') declares war on ' + G.online.humans[d].name + ' (' + World.countries[d].name + ')'); },
  warEnded(w, winner, how) { if (this.on && this.host && w.hh) this.net.send('all', { t: 'warEnd', a: w.a[0], d: w.d[0], winner, how, goal: w.goal }); },
  peace(w) {
    const me = G.player.idx, enemy = w.a.includes(me) ? w.d[0] : w.a[0];
    this.net.send('all', { t: 'peaceAsk', from: me, to: enemy, a: w.a[0], d: w.d[0] });
    return 'Ceasefire offer sent to ' + G.online.humans[enemy].name + '.';
  },
  // ---- every month: send our country; the host also sends the wars between players
  month() {
    if (!this.on || !G || !G.online) return;
    const me = G.player.idx, n = G.nations[me];
    this.net.send('all', { t: 'nat', idx: me, n: JSON.parse(JSON.stringify(n, (k, v) => k === 'rng' || k === 'why' || k === 'gwhy' ? undefined : v)) });
    if (this.host) { const list = G.wars.filter(w => w.hh).map(w => JSON.parse(JSON.stringify(w))); if (list.length) this.net.send('all', { t: 'wars', list }); }
  },
  // ---- the shared clock
  tick() {
    if (G && G.online && !this.on) G.online = null;           // an online save loaded later plays offline
    if (!this.on || !G) return;
    if (this.host) { this.net.send('all', { t: 'clk', day: G.day, speed: Clock.speed, paused: Clock.paused }, { fast: true }); return; }
    const h = this.hostClk; if (!h) return;
    Clock.speed = h.speed;
    const lag = h.day - G.day;
    if (lag < 0 || (h.paused && lag <= 0)) { Clock.paused = true; return; }
    Clock.paused = false;
    if (lag > 2 && $('#modal').classList.contains('hidden') && !G.over) for (let i = 0; i < Math.min(lag - 1, 8); i++) nextDay();      // catch up
  },
  // ---- the leaders board + chat
  board() {
    if (!G || !G.online) return;
    UI.modal(`<h2>🌐 Leaders</h2><div id="on-board"></div>
      <h3>Chat</h3><div id="on-chat" style="max-height:160px;overflow:auto;font-size:13px"></div>
      <div class="btnrow"><input id="on-say" maxlength="200" placeholder="Say something to the other leaders" style="flex:1;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:7px"><button class="btn" id="on-send">Send</button></div>
      <div class="btnrow"><button class="btn" id="on-ok">Close</button></div>`);
    const send = () => { const i = $('#on-say'), t = i.value.trim(); if (!t) return; i.value = ''; this.net.send('all', { t: 'chat', name: this.name, text: t }); this.chatLog.push({ name: this.name, text: t, day: G.day }); this.paintBoard(); };
    $('#on-send').onclick = send; $('#on-say').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); };
    $('#on-ok').onclick = () => UI.closeModal();
    this.paintBoard();
  },
  paintBoard() {
    const el = $('#on-board'); if (!el || !G || !G.online) return;
    const rows = Object.entries(G.online.humans).map(([i, h]) => { const n = G.nations[i]; return { i: +i, h, n, gdp: gdpUsd(n) }; }).sort((a, b) => b.gdp - a.gdp);
    el.innerHTML = `<table class="tbl" style="width:100%;font-size:13px"><tr><th></th><th>Leader</th><th>GDP</th><th>Growth</th><th>Approval</th><th>Army</th><th>Rules</th><th>At war with</th></tr>` +
      rows.map((r, k) => `<tr${r.i === G.player.idx ? ' style="color:var(--gold)"' : ''}><td>${k + 1}</td><td>${World.countries[r.i].flag} ${esc(r.h.name)}<div class="sub">${esc(World.countries[r.i].name)}</div></td><td>${usd(r.gdp)}</td><td>${(r.n.growth || 0).toFixed(1)}%</td><td>${(r.n.approval || 0).toFixed(0)}%</td><td>${fmtBig((r.n.army || {}).troops || 0)}</td><td>${G.nations.filter(m => m && m.owner === r.i).length}</td><td>${G.wars.filter(w => w.a.includes(r.i) || w.d.includes(r.i)).map(w => World.countries[w.a.includes(r.i) ? w.d[0] : w.a[0]].flag).join(' ') || '-'}</td></tr>`).join('') + '</table>';
    const c = $('#on-chat'); if (c) { c.innerHTML = this.chatLog.map(l => `<div><b>${esc(l.name)}</b> <span class="sub">${fmtDate(l.day)}</span> ${esc(l.text)}</div>`).join('') || '<div class="sub">No messages yet.</div>'; c.scrollTop = 1e6; }
  },
  bar() {
    let b = $('#onbar');
    if (!b) { b = document.createElement('div'); b.id = 'onbar'; document.body.appendChild(b); b.addEventListener('click', e => { const t = e.target.closest('[data-on]'); if (t) this.board(); }); }
    const on = !!(this.on && G && G.online && (UI.screen === 'game' || UI.screen === 'hud'));
    b.classList.toggle('on', on);
    if (on) b.innerHTML = `<b>ONLINE</b><span>${Object.keys(G.online.humans).length} leaders · room ${esc(this.code)}${this.host ? ' · you run the clock' : ''}</span><button class="btn small" data-on="board">Leaders & chat</button>`;
  }
};
// the AI never plays a human's country, and leaves the other players alone (wars with them are between players)
function isHuman(idx) { return idx === pIdx() || !!(G && G.online && G.online.humans && G.online.humans[idx]); }
MONTHLY.push(() => Online.month());
setInterval(() => { try { Online.tick(); Online.bar(); } catch (e) {} }, 400);
// guests do not control time
(() => {
  const set0 = Clock.set, tog0 = Clock.toggle;
  Clock.set = function (s) { if (Online.on && !Online.host) { toast('The host controls the clock.'); return; } return set0.call(this, s); };
  Clock.toggle = function () { if (Online.on && !Online.host) { toast('The host controls the clock.'); return; } return tog0.call(this); };
  const dec0 = War.declare, peace0 = War.peace;
  War.declare = function (t, goal) { if (Online.on && G.online && G.online.humans[t]) return Online.declare(t, goal); return dec0.call(this, t, goal); };
  War.peace = function (w, terms) { if (Online.on && w && w.hh) return Online.peace(w); return peace0.call(this, w, terms); };
})();
// the launcher: join from an invite / open party / Quick Match, or host for one
window.__hgJoin = c => { Online.open(); $('#on-code').value = c; Online.joinRoom(c); return true; };
window.__hgHost = convId => { Online.open(); Online.hostRoom(); const iv = setInterval(() => { if (Online.code) { clearInterval(iv); try { window.parent.HG_sendInvite(convId, { game: 'sovereign', code: Online.code, max: 6 }); } catch (e) {} } }, 300); setTimeout(() => clearInterval(iv), 25000); };
setTimeout(function hgBoot() { try { if (!window.__sov || !window.__sov.ready) return setTimeout(hgBoot, 500); const p = window.parent; if (!p || p === window) return; const c = p.HG_takeJoin && p.HG_takeJoin('sovereign'); if (c) return window.__hgJoin(c); const h = p.HG_takeHost && p.HG_takeHost('sovereign'); if (h && h.convId) window.__hgHost(h.convId); } catch (e) {} }, 800);
