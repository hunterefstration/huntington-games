// Live tables everyone shares: Live Roulette, Live Rocket, Horse Racing, The Pot, Duels. Rounds run on the server
// clock (round r starts at r * cyc, betting closes at bet ms); bets and results arrive as events.

const myName = () => (S.me && S.me.name) || '';
const isMe = n => !!n && n === myName();
// the side panel of a live table: who is in this round, and the last results
function liveSide(title) {
  const pl = h('div', { class: 'lplayers' }), rs = h('div', { class: 'lresults' }), cnt = h('small');
  const el = h('div', { class: 'lside' }, h('h3', null, title || 'This round ', cnt), pl, h('h3', null, 'Last results'), rs);
  return {
    el,
    players(list, extra) {
      pl.innerHTML = ''; cnt.textContent = list.length ? '· ' + list.length + ' in' : '';
      if (!list.length) pl.append(h('p', { class: 'small' }, 'No bets yet. Be the first!'));
      list.slice().sort((a, b) => b.a - a.a).forEach(p => pl.append(h('div', { class: 'lp' + (isMe(p.n) ? ' me' : '') + (p.fresh ? ' fresh' : '') }, h('span', null, p.n), extra ? extra(p) : null, h('b', { class: 'num' }, fmt(p.a)))));
    },
    results(list, head) {
      rs.innerHTML = ''; if (head) rs.append(h('div', { class: 'lrh' }, head));
      if (!list || !list.length) { rs.append(h('p', { class: 'small' }, 'Results show here when a round is paid.')); return; }
      list.forEach(x => rs.append(h('div', { class: 'lp' + (isMe(x.n) ? ' me' : '') + (x.win > 0 ? ' won' : '') }, h('span', null, x.n), h('b', { class: 'num' }, x.win > 0 ? '+' + fmt(x.win - x.stake) : '−' + fmt(x.stake)))));
    }
  };
}
// a live table's heartbeat: the countdown, round changes, events, and a re-sync when the tab comes back
function liveLoop(key, fns) {
  let raf = 0, lastR = null, dead = false;
  const L = () => S.live && S.live[key];
  const frame = () => {
    if (dead) return; const T = L();
    if (T) { const p = phase(T); if (p.r !== T.r) { T.r = p.r; T.players = []; if ('n' in T) T.n = null; if ('order' in T) T.order = null; if ('total' in T) T.total = 0; } if (lastR !== T.r) { const was = lastR; lastR = T.r; fns.round && fns.round(T, was); } fns.frame && fns.frame(T, p); }
    raf = requestAnimationFrame(frame);
  };
  const onEv = m => { if (fns.ev) fns.ev(m, L()); };
  const vis = async () => { if (document.hidden) return; await refreshLive(); lastR = null; fns.resync && fns.resync(L()); };
  evHandlers.add(onEv); document.addEventListener('visibilitychange', vis);
  const iv = setInterval(() => { if (document.hidden) frame(); }, 1000);       // keep the round counter honest while hidden
  requestAnimationFrame(frame);
  return () => { dead = true; cancelAnimationFrame(raf); clearInterval(iv); evHandlers.delete(onEv); document.removeEventListener('visibilitychange', vis); };
}
function clockBar() {
  const fill = h('i'), txt = h('span'), el = h('div', { class: 'lclock' }, h('div', { class: 'lcb' }, fill), txt);
  return { el, set(frac, text, cls) { fill.style.width = clamp(frac, 0, 1) * 100 + '%'; txt.textContent = text; el.className = 'lclock ' + (cls || ''); } };
}
const rlMult = k => (k[0] === 'n' ? 36 : k[0] === 'd' || k[0] === 'c' ? 3 : 2);

// ---------- Live Roulette ----------
defGame({ id: 'lr', title: 'Live Roulette', group: 'live', icon: '🎯', c1: '#c2283a', c2: '#3a0910', blurb: 'One wheel for the whole room', hint: 'Place chips, then Place bets before the clock runs out',
  mount() {
    const def = this, side = liveSide('At the table'), F = gameFrame(def, side.el);
    const W = rouletteWheel(), res = h('div', { class: 'rres' }), hist = h('div', { class: 'rhist' }), clock = clockBar();
    const book = chipBook(def.id, () => { T.paint(book.bets, mine); bar.setTotal(book.total() + total(mine)); });
    const T = rouletteTable(k => { if (S.busy) return; const p = phase(S.live.lr); if (p.left < 400) return toast('Bets are closed for this round.', 'err'); book.add(k, bar.chip); });
    F.main.append(h('div', { class: 'felt rfelt live' }, h('div', { class: 'rw' }, W.el, res, hist), h('div', { class: 'rt' }, clock.el, T.el)));
    const bar = betBar(def, { mode: 'chips', label: 'Place bets', go: place, undo: book.undo, clear: book.clear, repeat: book.repeat }); F.bar.append(bar.el);
    let mine = {}, myR = -1, spun = -1, settled = -1;
    const total = o => Object.values(o).reduce((t, a) => t + a, 0);
    const drawHist = L => { hist.innerHTML = ''; (L.last || []).slice(0, 10).forEach(n => hist.append(h('span', { class: 'rn ' + numCol(n) }, n))); };
    async function place() {
      const bets = book.list(); if (!bets.length) return toast('Put chips on the table first.', 'err');
      await act(async () => {
        const rep = await call('lr', { bets }); book.remember(); mine = {}; for (const b of rep.r.bets) mine[b.k] = (mine[b.k] || 0) + b.a; myR = rep.r.round; book.clear(); sfx.chip();
        toast('Bets placed: ' + fmt(total(mine)) + ' chips on round ' + rep.r.round);
      });
    }
    async function spinTo(L, n) {
      if (spun === L.r) return; spun = L.r; const p = phase(L), left = (L.pay || L.bet + 5000) - p.x - 300;
      if (left < 800) { W.show(n); } else { await W.spinTo(n, Math.min(4600, left)); }
      res.className = 'rres ' + numCol(n); res.textContent = n; T.mark(n);
      if (!(L.last && L.last[0] === n && L.lastR === L.r)) { L.last = [n].concat(L.last || []).slice(0, 12); L.lastR = L.r; } drawHist(L);
      if (myR === L.r && settled !== L.r) { settled = L.r; const stake = total(mine); let win = 0; for (const k in mine) if (rouletteWins(k, n)) win += mine[k] * rlMult(k); finish('lr', stake, win, n + ' ' + ({ r: 'red', b: 'black', g: 'green' })[numCol(n)], F.main); }
    }
    const stop = liveLoop('lr', {
      round(L) { if (myR !== L.r) { mine = {}; } T.mark(null); res.textContent = ''; res.className = 'rres'; W.n = null; W.draw(); drawHist(L); side.players(L.players); book.bets && T.paint(book.bets, mine); bar.setTotal(book.total() + total(mine)); },
      frame(L, p) {
        if (p.left > 0) clock.set(p.left / L.bet, 'Bets close in ' + secs(p.left) + 's' + (myR === L.r ? ' · you have ' + fmt(total(mine)) + ' on the table' : ''), p.left < 5000 ? 'hurry' : 'open');
        else { clock.set(0, 'No more bets · ' + (spun === L.r ? 'next round in ' + secs(p.toNext) + 's' : 'spinning…'), 'closed'); if (L.n != null && spun !== L.r) spinTo(L, L.n); }
        bar.label(p.left > 400 ? 'Place bets' : 'Closed', p.left > 400);
      },
      ev(m, L) {
        if (!L) return;
        if (m.ev === 'bet' && m.g === 'lr') { side.players(L.players.map(p => Object.assign({}, p, { fresh: p.n === m.n }))); if (!isMe(m.n)) sfx.chip(); }
        else if (m.ev === 'lr' && m.r === L.r) { L.n = m.n; spinTo(L, m.n); }
        else if (m.ev === 'paid' && m.g === 'lr') side.results(m.results, 'Round ' + m.r + (L.lastR === m.r && L.last ? ' · ' + L.last[0] : ''));
      },
      resync(L) { spun = -1; }
    });
    drawHist(S.live.lr); side.results([]);
    return { root: F.root, primary: place, unmount: stop, key: e => { if (e.key.toLowerCase() === 'r') { book.repeat(); return true; } if (e.key === 'Backspace') { book.clear(); return true; } } };
  } });

// ---------- Live Rocket ----------
defGame({ id: 'crash', title: 'Live Rocket', group: 'live', icon: '🚀', c1: '#e05a1a', c2: '#3d1405', blurb: 'Everyone flies, who cashes out?', hint: 'Space = board / cash out',
  mount() {
    const def = this, side = liveSide('On board'), F = gameFrame(def, side.el);
    const cv = h('canvas', { class: 'rcv' }), big = h('div', { class: 'rbig num' }, ''), pops = h('div', { class: 'pops' }), hist = h('div', { class: 'chist2' }), clock = clockBar(), G = rocketGraph(cv);
    F.main.append(h('div', { class: 'rbox live' }, clock.el, cv, big, pops, hist));
    const unfit = fitCanvas(cv, G.draw);
    let my = null, crashAt = {};                       // my = { r, bet, auto, out, done }
    const autoIn = h('input', { class: 'inp num', type: 'number', min: 0, max: 190, step: 0.1, placeholder: 'off', value: store.get('crash:auto', '') || '' , oninput: () => store.set('crash:auto', autoIn.value) });
    const cashBtn = h('button', { class: 'btn big green cashbig hidden', onclick: () => cashOut() }, 'CASH OUT');
    const bar = betBar(def, { label: 'Board', go: board, extra: [h('div', { class: 'seg' }, h('span', null, 'Auto cash-out'), autoIn, h('span', null, 'x'))] }); F.bar.append(bar.el); bar.el.append(cashBtn);
    const drawHist = L => { hist.innerHTML = ''; (L.last || []).slice(0, 10).forEach(c => hist.append(h('span', { class: c >= 2 ? 'hi' : 'lo' }, fmtX(c)))); };
    const flyM = (L, p) => Math.exp(L.k * (p.x - L.bet));
    async function board() {
      const L = S.live.crash, p = phase(L); if (p.left < 300) return toast('It has launched. Board the next one.', 'err'); if (my && my.r === L.r) return;
      const auto = +autoIn.value || 0;
      await act(async () => { const rep = await call('crash', auto >= 1.01 ? { bet: bar.bet, auto } : { bet: bar.bet }); my = { r: rep.r.round, bet: rep.r.bet, auto: rep.r.auto || 0, out: 0, done: false }; sfx.chip(); toast('You are on board' + (my.auto ? ' (auto cash-out at ' + fmtX(my.auto) + ')' : '') + '.'); });
    }
    async function cashOut() {
      const L = S.live.crash; if (!my || my.r !== L.r || my.out || my.done) return;
      await act(async () => { const rep = await call('crash', { act: 'cash' }); my.out = rep.r.mult; my.done = true; G.cashAt = rep.r.mult; finish('crash', my.bet, rep.r.win, 'Cashed out at ' + fmtX(rep.r.mult), F.main); });
    }
    function pop(t, cls) { const e = h('div', { class: 'pop ' + (cls || '') }, t); pops.append(e); setTimeout(() => e.remove(), 2600); }
    const stop = liveLoop('crash', {
      round(L) { G.crashed = 0; G.cashAt = 0; G.m = 1; G.state = 'idle'; big.className = 'rbig num'; drawHist(L); side.players(L.players, pp => pp.out ? h('em', null, fmtX(pp.out)) : null); },
      frame(L, p) {
        const mineNow = my && my.r === L.r, c = crashAt[L.r];
        if (p.left > 0) {
          clock.set(p.left / L.bet, 'Boarding · launch in ' + (p.left / 1000).toFixed(1) + 's', 'open'); G.m = 1; G.state = 'idle'; G.target = mineNow && my.auto ? my.auto : 0;
          big.textContent = mineNow ? 'You are on board · ' + fmt(my.bet) : 'Board now!'; bar.label(mineNow ? 'On board' : 'Board', !mineNow);
          cashBtn.classList.add('hidden'); bar.prim.classList.remove('hidden');
        } else {
          const m = c ? c : flyM(L, p); G.m = Math.max(1, m); G.state = 'fly'; G.crashed = c ? 1 : 0;
          clock.set(0, c ? 'Next launch in ' + secs(p.toNext) + 's' : 'In flight', c ? 'closed' : 'fly');
          big.textContent = c ? 'Blew up at ' + fmtX(c) : G.m.toFixed(2) + 'x'; big.classList.toggle('l', !!c);
          const canCash = mineNow && !my.out && !my.done && !c;
          cashBtn.classList.toggle('hidden', !canCash); bar.prim.classList.toggle('hidden', canCash); bar.label('Wait for the next one', false);
          if (canCash) cashBtn.textContent = 'CASH OUT ' + fmt(Math.floor(my.bet * G.m)) + ' · ' + G.m.toFixed(2) + 'x';
          if (mineNow && my.auto && !my.out && !c && G.m >= my.auto) { my.out = my.auto; G.cashAt = my.auto; pop('Auto cash-out at ' + fmtX(my.auto), 'me'); }
        }
        G.draw();
      },
      ev(m, L) {
        if (!L) return;
        if (m.ev === 'bet' && m.g === 'crash') { side.players(L.players, pp => pp.out ? h('em', null, fmtX(pp.out)) : null); if (!isMe(m.n)) sfx.chip(); }
        else if (m.ev === 'out' && m.r === L.r) { const p = L.players.find(x => x.n === m.n); if (p) p.out = m.mult; side.players(L.players, pp => pp.out ? h('em', null, fmtX(pp.out)) : null); pop(m.n + ' cashed out at ' + fmtX(m.mult) + ' (+' + fmt(m.win) + ')', isMe(m.n) ? 'me' : ''); }
        else if (m.ev === 'crash') {
          crashAt[m.r] = m.c; if (m.r === L.r) { L.last = [m.c].concat(L.last || []).slice(0, 12); drawHist(L); sfx.boom(); }
          if (my && my.r === m.r && !my.done) { my.done = true; const win = my.auto && my.auto <= m.c ? Math.floor(my.bet * my.auto) : 0; finish('crash', my.bet, win, win ? 'Auto cash-out at ' + fmtX(my.auto) : 'Blew up at ' + fmtX(m.c), F.main); }
        }
        else if (m.ev === 'paid' && m.g === 'crash') side.results(m.results, 'Flight ' + m.r + (crashAt[m.r] ? ' · ' + fmtX(crashAt[m.r]) : ''));
      },
      resync(L) { drawHist(L); }
    });
    side.results([]);
    return { root: F.root, unmount: () => { stop(); unfit(); }, primary: () => (cashBtn.classList.contains('hidden') ? board() : cashOut()) };
  } });

// ---------- Horse Racing ----------
const SILKS = ['#e2434b', '#2b6fe0', '#f6c446', '#1c9a55', '#8a3bd1', '#ff8a00'];
defGame({ id: 'race', title: 'Horse Racing', group: 'live', icon: '🏇', c1: '#2f8a3a', c2: '#0d3312', blurb: 'Six horses, every 45 s', hint: 'Click a horse to back it with the chip you picked',
  mount() {
    const def = this, side = liveSide('In the betting'), F = gameFrame(def, side.el), L0 = S.live.race, names = L0.names, odds = L0.odds;
    const clock = clockBar(), track = h('div', { class: 'track' }), board = h('div', { class: 'rboard' });
    const lanes = names.map((n, i) => {
      const horse = h('div', { class: 'horse' }, h('span', { class: 'hh' }, '🏇'), h('span', { class: 'cloth', style: { background: SILKS[i] } }, i + 1));
      const lane = h('div', { class: 'lane' }, horse); track.append(lane); return { lane, horse };
    });
    track.append(h('div', { class: 'finish' }));
    const book = chipBook(def.id, paint), rows = names.map((n, i) => h('button', { class: 'rbet', onclick: () => backIt(i) }, h('span', { class: 'cloth', style: { background: SILKS[i] } }, i + 1), h('b', null, n), h('span', { class: 'odds' }, fmtX(odds[i])), h('span', { class: 'slip' })));
    board.append(...rows);
    F.main.append(h('div', { class: 'felt racefelt' }, clock.el, track, board));
    const bar = betBar(def, { mode: 'chips', label: 'Place bets', go: place, undo: book.undo, clear: book.clear, repeat: book.repeat }); F.bar.append(bar.el);
    let mine = {}, myR = -1, settled = -1, order = null, raceR = -1;
    const total = o => Object.values(o).reduce((t, a) => t + a, 0);
    function paint() { rows.forEach((r, i) => { const k = 'h' + i, s = r.querySelector('.slip'); s.innerHTML = ''; if (mine[k]) s.append(h('span', { class: 'placed' }, fmt(mine[k]))); if (book.bets[k]) s.append(chipEl(book.bets[k], 's')); }); bar.setTotal(book.total() + total(mine)); }
    function backIt(i) { if (S.busy) return; if (phase(S.live.race).left < 400) return toast('Betting is closed: the race is on.', 'err'); book.add('h' + i, bar.chip); }
    async function place() {
      const bets = book.list().map(b => ({ h: +b.k.slice(1), a: b.a })); if (!bets.length) return toast('Back a horse first.', 'err');
      await act(async () => { const rep = await call('race', { bets }); book.remember(); mine = {}; for (const b of rep.r.bets) mine['h' + b.h] = (mine['h' + b.h] || 0) + b.a; myR = rep.r.round; book.clear(); sfx.chip(); toast('Bets placed on race ' + rep.r.round); });
    }
    const T_P = p => 9.4 + p * 0.42;          // seconds after the start that the horse in place p crosses the line
    function placeHorses(t) {
      lanes.forEach(({ horse }, i) => {
        let x = 0;
        if (order) { const p = order.indexOf(i), T = T_P(p), q = Math.min(1, t / T); x = q < 1 ? q + 0.035 * Math.sin(t * 1.9 + i * 2.1) * Math.sin(Math.PI * q) : 1 + Math.min(0.04, (t - T) * 0.02); }
        horse.style.left = 'calc(' + (clamp(x, 0, 1.04) * 88) + '% + 4px)'; horse.classList.toggle('run', !!order && x < 1 && t > 0);
      });
    }
    const stop = liveLoop('race', {
      round(L) { if (myR !== L.r) mine = {}; order = L.order || null; raceR = L.r; settled = settled; lanes.forEach(l => l.lane.classList.remove('won')); rows.forEach(r => r.classList.remove('won')); side.players(L.players); paint(); placeHorses(0); },
      frame(L, p) {
        if (p.left > 0) { clock.set(p.left / L.bet, 'Betting closes in ' + secs(p.left) + 's' + (myR === L.r ? ' · you have ' + fmt(total(mine)) + ' on' : ''), p.left < 5000 ? 'hurry' : 'open'); bar.label('Place bets', true); placeHorses(0); return; }
        bar.label('Race on', false); if (!order && L.order) order = L.order;
        const t = (p.x - L.bet) / 1000; placeHorses(order ? t : 0);
        if (order && t >= T_P(0) && settled !== L.r) {
          settled = L.r; lanes[order[0]].lane.classList.add('won'); rows[order[0]].classList.add('won'); sfx.win(false);
          if (myR === L.r) { const stake = total(mine), win = Math.floor((mine['h' + order[0]] || 0) * odds[order[0]]); finish('race', stake, win, names[order[0]] + ' wins', F.main); }
          else toast(names[order[0]] + ' wins race ' + L.r + '!');
        }
        clock.set(0, order ? (t < T_P(5) ? 'And they\'re off!' : 'Result: ' + order.slice(0, 3).map((h2, i) => (i + 1) + '. ' + names[h2]).join('  ') + ' · next in ' + secs(p.toNext) + 's') : 'Under starter\'s orders…', 'closed');
      },
      ev(m, L) {
        if (!L) return;
        if (m.ev === 'bet' && m.g === 'race') { side.players(L.players.map(p => Object.assign({}, p, { fresh: p.n === m.n }))); if (!isMe(m.n)) sfx.chip(); }
        else if (m.ev === 'race' && m.r === L.r) { L.order = m.order; order = m.order; sfx.spin(); }
        else if (m.ev === 'paid' && m.g === 'race') side.results(m.results, 'Race ' + m.r);
      },
      resync(L) { order = L.order || null; }
    });
    side.results([]);
    return { root: F.root, primary: place, unmount: stop };
  } });

// ---------- The Pot ----------
const potCol = (n, i) => { let x = 0; for (const c of n) x = (x * 31 + c.charCodeAt(0)) >>> 0; return 'hsl(' + ((x + i * 47) % 360) + ' 70% 55%)'; };
defGame({ id: 'pot', title: 'The Pot', group: 'live', icon: '🍯', c1: '#c98a12', c2: '#3d2803', blurb: 'Winner takes the pot', hint: 'Your chance = your share of the pot',
  mount() {
    const def = this, side = liveSide('In the pot'), F = gameFrame(def, side.el), clock = clockBar();
    const cv = h('canvas', { class: 'potcv', width: 440, height: 440 }), info = h('div', { class: 'potinfo' }), winner = h('div', { class: 'potwin' });
    F.main.append(h('div', { class: 'felt potfelt' }, clock.el, h('div', { class: 'potmid' }, h('div', { class: 'potwrap' }, cv, h('div', { class: 'wptr' }, '▼')), h('div', null, info, winner))));
    const bar = betBar(def, { label: 'Add to the pot', go: join }); F.bar.append(bar.el);
    let snap = null, rot = 0, spinning = false, mineR = -1, mine = 0;
    function slices(list) { const tot = list.reduce((t, p) => t + p.a, 0) || 1; let a = 0; return list.map((p, i) => { const s = { n: p.n, a: p.a, a0: a, a1: a + p.a / tot * 2 * Math.PI, col: potCol(p.n, i) }; a = s.a1; return s; }); }
    function draw(list, hi) {
      const c = cv.getContext('2d'), W = cv.width, R = W / 2 - 10; c.clearRect(0, 0, W, W); c.save(); c.translate(W / 2, W / 2); c.rotate(rot - Math.PI / 2);
      const sl = slices(list);
      if (!sl.length) { c.beginPath(); c.arc(0, 0, R, 0, 7); c.fillStyle = '#262c47'; c.fill(); }
      for (const s of sl) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, s.a0, s.a1); c.closePath(); c.fillStyle = s.col; c.globalAlpha = hi && hi !== s.n ? 0.35 : 1; c.fill(); c.globalAlpha = 1; c.strokeStyle = isMe(s.n) ? '#fff' : '#0008'; c.lineWidth = isMe(s.n) ? 4 : 1.5; c.stroke();
        if (s.a1 - s.a0 > 0.25) { c.save(); c.rotate((s.a0 + s.a1) / 2); c.fillStyle = '#111'; c.font = 'bold 15px system-ui'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(s.n.slice(0, 12), R - 10, 0); c.restore(); } }
      c.beginPath(); c.arc(0, 0, R * 0.36, 0, 7); c.fillStyle = '#15192e'; c.fill(); c.strokeStyle = '#f6c446'; c.lineWidth = 4; c.stroke(); c.restore();
      const tot = list.reduce((t, p) => t + p.a, 0); c.fillStyle = '#ffdf7e'; c.font = 'bold 30px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🍯 ' + fmt(tot), W / 2, W / 2 - 6); c.fillStyle = '#9aa1c2'; c.font = '14px system-ui'; c.fillText('chips in the pot', W / 2, W / 2 + 22);
    }
    async function join() {
      const L = S.live.pot; if (phase(L).left < 400) return toast('The pot is being drawn. Join the next one.', 'err');
      await act(async () => { const rep = await call('pot', { bet: bar.bet }); mineR = rep.r.round; mine = rep.r.bet; snap = null; winner.textContent = ''; sfx.chip(); toast('You have ' + fmt(mine) + ' chips in the pot.'); });
    }
    async function spin(m) {
      const list = (snap = S.live.pot.players.slice()), sl = slices(list), w = sl.find(s => s.n === m.winner); spinning = true; winner.textContent = '';
      if (w && list.length > 1) { const a = w.a0 + (w.a1 - w.a0) * (0.2 + Math.random() * 0.6); let r1 = -a; while (r1 < rot + 2 * Math.PI * 4) r1 += 2 * Math.PI; const r0 = rot; sfx.spin(); await tween(4200, e => { rot = r0 + (r1 - r0) * e; draw(list); }); }
      spinning = false; draw(list, m.winner);
      winner.innerHTML = m.winner ? `🏆 <b>${esc(m.winner)}</b> takes <b class="gold">${fmt(Math.floor((m.total || 0) * 0.97))}</b> chips!` : list.length === 1 ? 'Nobody else joined: the stake went back.' : 'Nobody played this pot.';
      side.results(m.results, 'Pot ' + m.r);
      if (mineR === m.r) { const me = (m.results || []).find(x => isMe(x.n)); const win = me ? me.win : isMe(m.winner) ? Math.floor(m.total * 0.97) : 0; finish('pot', mine, win, isMe(m.winner) ? 'You took the pot!' : 'The pot went to ' + (m.winner || 'nobody'), F.main); mineR = -1; }
    }
    const stop = liveLoop('pot', {
      round(L) { side.players(L.players); },
      frame(L, p) {
        const s = secs(p.left), list = L.players, tot = list.reduce((t, x) => t + x.a, 0), me = list.find(x => isMe(x.n));
        if (p.left > 0) clock.set(p.left / L.bet, 'Draw in ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), p.left < 10000 ? 'hurry' : 'open'); else clock.set(0, 'Drawing… next pot in ' + secs(p.toNext) + 's', 'closed');
        bar.label(p.left > 400 ? 'Add to the pot' : 'Drawing', p.left > 400);
        info.innerHTML = `<div><small>Players</small><b>${list.length}</b></div><div><small>Your chips</small><b>${me ? fmt(me.a) : 0}</b></div><div><small>Your chance</small><b class="gold">${me && tot ? (me.a / tot * 100).toFixed(1) + '%' : '0%'}</b></div><div><small>Prize now</small><b>${fmt(Math.floor(tot * 0.97))}</b></div>`;
        if (!spinning && !snap) draw(list);
      },
      ev(m, L) {
        if (!L) return;
        if (m.ev === 'bet' && m.g === 'pot') { if (snap && m.r === L.r) { snap = null; winner.textContent = ''; } side.players(L.players.map(p => Object.assign({}, p, { fresh: p.n === m.n }))); if (!isMe(m.n)) sfx.chip(); }
        else if (m.ev === 'paid' && m.g === 'pot') spin(m);
      }
    });
    side.results([]);
    return { root: F.root, primary: join, unmount: stop };
  } });

// ---------- Duels ----------
defGame({ id: 'duel', title: 'Duels', group: 'live', icon: '⚔️', c1: '#5a3aa8', c2: '#1d1040', blurb: 'Coin flip against a player', hint: 'Take a duel or open your own (up to 1000 chips)',
  mount() {
    const def = this, recent = h('div', { class: 'lresults' }), F = gameFrame(def, h('div', { class: 'lside' }, h('h3', null, 'Recent duels'), recent));
    const list = h('div', { class: 'dlist' }), arena = h('div', { class: 'arena' });
    const coin = h('div', { class: 'coin' }, h('div', { class: 'cf h' }, h('span', null, '⚔️'), h('small', { class: 'cn-a' }, '')), h('div', { class: 'cf t' }, h('span', null, '🛡️'), h('small', { class: 'cn-b' }, '')));
    arena.append(h('div', { class: 'cstage' }, coin), h('div', { class: 'arena-t' }, 'Take an open duel, or open one and wait for a challenger.'));
    F.main.append(h('div', { class: 'felt duelfelt' }, h('div', { class: 'dcol' }, h('h3', null, 'Open duels'), list), arena));
    const bar = betBar(def, { label: 'Open a duel', go: open, max: 1000 }); F.bar.append(bar.el);
    const seen = new Set(); let rot = 0, past = [];
    function render() {
      const ds = (S.live && S.live.duels) || []; list.innerHTML = '';
      if (!ds.length) list.append(h('p', { class: 'small' }, 'No open duels. Open one!'));
      ds.slice().sort((a, b) => b.at - a.at).forEach(d => list.append(h('div', { class: 'drow2' + (isMe(d.n) ? ' me' : '') }, h('span', { class: 'dn' }, '⚔️ ', h('b', null, d.n)), h('span', { class: 'num' }, chipEl(d.bet, 's'), ' ' + fmt(d.bet)), h('small', null, ago(d.at)),
        isMe(d.n) ? h('button', { class: 'btn sm lockable', onclick: () => cancel(d) }, 'Cancel') : h('button', { class: 'btn sm gold lockable', onclick: () => take(d) }, 'Take · win ' + fmt(Math.floor(d.bet * 2 * 0.97))))));
    }
    function drawRecent() { recent.innerHTML = ''; if (!past.length) recent.append(h('p', { class: 'small' }, 'Finished duels show here.')); past.slice(0, 12).forEach(x => recent.append(h('div', { class: 'lp' + (isMe(x.winner) ? ' me won' : '') }, h('span', null, x.a + ' vs ' + x.b), h('b', null, '🏆 ' + x.winner)))); }
    async function open() { await act(async () => { await call('duel', { act: 'open', bet: bar.bet }); sfx.chip(); toast('Duel opened. Waiting for a challenger…'); await refreshLive(); render(); }); }
    async function cancel(d) { await act(async () => { await call('duel', { act: 'cancel', id: d.id }); toast('Duel cancelled, chips back.'); await refreshLive(); render(); }); }
    async function take(d) {
      await act(async () => { const rep = await call('duel', { act: 'take', id: d.id }, { hold: true }); await show({ id: d.id, a: d.n, b: myName(), bet: d.bet, winner: rep.r.won ? myName() : d.n, prize: rep.r.prize }); releaseBal(); });
    }
    async function show(x) {
      if (seen.has(x.id)) return; seen.add(x.id); past.unshift(x); drawRecent();
      const mine = isMe(x.a) || isMe(x.b); if (!mine) return;
      coin.querySelector('.cn-a').textContent = x.a; coin.querySelector('.cn-b').textContent = x.b; $('.arena-t', arena).textContent = x.a + ' vs ' + x.b + ' for ' + fmt(x.bet * 2) + ' chips…';
      const end = Math.ceil(rot / 360) * 360 + 360 * 6 + (x.winner === x.b ? 180 : 0), r0 = rot; sfx.flip();
      await animate(() => tween(1700, (e, p) => { rot = r0 + (end - r0) * e; coin.style.transform = `translateY(${-Math.sin(p * Math.PI) * 70}px) rotateY(${rot}deg)`; }));
      rot = end; coin.style.transform = `rotateY(${rot}deg)`; $('.arena-t', arena).textContent = '🏆 ' + x.winner + ' wins ' + fmt(x.prize) + ' chips';
      finish('duel', x.bet, isMe(x.winner) ? x.prize : 0, isMe(x.winner) ? 'You won the duel' : x.winner + ' won the duel', F.main);
    }
    const onEv = m => { if (m.ev === 'duels') render(); else if (m.ev === 'duel') { if (seen.has(m.id)) return; show(m); setTimeout(render, 50); } };
    evHandlers.add(onEv); const iv = setInterval(render, 5000);
    const vis = () => { if (!document.hidden) refreshLive().then(render); }; document.addEventListener('visibilitychange', vis);
    render(); drawRecent(); refreshLive().then(render);
    return { root: F.root, primary: open, unmount: () => { evHandlers.delete(onEv); clearInterval(iv); document.removeEventListener('visibilitychange', vis); } };
  } });
