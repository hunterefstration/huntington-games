// Table games: Blackjack, Roulette, Baccarat, Craps, Sic Bo, Video Poker (+ the roulette wheel, layout and dice they share).

function openGame(id, resume) {
  const def = gameById(id); if (!def) return openLobby();
  clearView(); document.body.classList.remove('at-lobby'); view = { kind: 'game', id };
  const g = def.mount({ resume: !!resume }); S.game = g; g.def = def; $('#main').append(g.root);
  if (g.start) g.start();
}

// ---------- dice ----------
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function dieEl(v, cls) { const d = h('div', { class: 'die ' + (cls || '') }); setDie(d, v); return d; }
function setDie(d, v) { d.innerHTML = ''; for (let i = 0; i < 9; i++) d.append(h('i', { class: PIPS[v].includes(i) ? 'p' : '' })); d.dataset.v = v; }
async function tumble(dice, faces, ms) {
  sfx.roll(); dice.forEach(d => d.classList.add('rolling'));
  await tween(ms || 700, (e, p) => { if (p < 1 && Math.random() < 0.5) dice.forEach(d => setDie(d, 1 + Math.floor(Math.random() * 6))); });
  dice.forEach((d, i) => { d.classList.remove('rolling'); setDie(d, faces[i]); });
}

// ---------- roulette: wheel and table, shared with Live Roulette ----------
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const numCol = n => (n === 0 ? 'g' : REDS.has(n) ? 'r' : 'b');
function rouletteWheel() {
  const cv = h('canvas', { class: 'rwheel', width: 420, height: 420 });
  const W = { el: cv, rot: 0, ball: -Math.PI / 2, br: 1, n: null };
  const step = 2 * Math.PI / 37;
  W.draw = () => {
    const c = cv.getContext('2d'), S2 = cv.width, R = S2 / 2 - 4; c.clearRect(0, 0, S2, S2); c.save(); c.translate(S2 / 2, S2 / 2);
    const g0 = c.createRadialGradient(0, 0, R * 0.2, 0, 0, R); g0.addColorStop(0, '#6b3f1d'); g0.addColorStop(1, '#3a210d'); c.fillStyle = g0; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    c.strokeStyle = '#d9a63a'; c.lineWidth = 5; c.stroke();
    c.save(); c.rotate(W.rot);
    for (let i = 0; i < 37; i++) {
      const n = WHEEL_ORDER[i], a0 = -Math.PI / 2 + (i - 0.5) * step;
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * 0.86, a0, a0 + step); c.closePath(); c.fillStyle = n === 0 ? '#14894f' : REDS.has(n) ? '#c8202f' : '#161616'; c.fill(); c.strokeStyle = '#c9a24a88'; c.lineWidth = 1; c.stroke();
      c.save(); c.rotate(a0 + step / 2); c.translate(R * 0.77, 0); c.rotate(Math.PI / 2); c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(S2 / 30) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, 0, 0); c.restore();
      if (W.n === n) { c.beginPath(); c.arc(0, 0, R * 0.86, a0, a0 + step); c.arc(0, 0, R * 0.58, a0 + step, a0, true); c.closePath(); c.fillStyle = '#ffffff40'; c.fill(); }
    }
    c.beginPath(); c.arc(0, 0, R * 0.58, 0, 7); const g1 = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.58); g1.addColorStop(0, '#e2b45a'); g1.addColorStop(0.6, '#7a4a1e'); g1.addColorStop(1, '#4a2a10'); c.fillStyle = g1; c.fill();
    for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2); c.fillStyle = '#e8c56a'; c.fillRect(-3, -R * 0.45, 6, R * 0.9); c.restore(); }
    c.beginPath(); c.arc(0, 0, R * 0.1, 0, 7); c.fillStyle = '#f3d27a'; c.fill();
    c.restore();
    const br = R * (0.62 + 0.3 * W.br); c.beginPath(); c.arc(Math.cos(W.ball) * br, Math.sin(W.ball) * br, S2 / 38, 0, 7);
    const gb = c.createRadialGradient(-3, -3, 1, 0, 0, S2 / 38); c.fillStyle = '#fff'; c.shadowColor = '#000a'; c.shadowBlur = 6; c.fill(); c.shadowBlur = 0;
    c.restore();
  };
  // spin so the ball comes to rest in the pocket of n
  W.spinTo = async (n, ms) => {
    W.n = null; const idx = WHEEL_ORDER.indexOf(n), r0 = W.rot, r1 = r0 + 2 * Math.PI * 2 + Math.random() * 2 * Math.PI;
    let b1 = r1 + idx * step - Math.PI / 2; const b0 = W.ball; while (b1 > b0 - 2 * Math.PI * 4) b1 -= 2 * Math.PI;
    sfx.spin(); let lastI = 0;
    await tween(ms || 5000, (e, p) => {
      W.rot = r0 + (r1 - r0) * e; W.ball = b0 + (b1 - b0) * e; W.br = p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.3) + (p < 0.9 ? Math.abs(Math.sin(p * 40)) * 0.08 * (1 - p) : 0);
      const ci = Math.floor((W.ball - W.rot) / step); if (ci !== lastI) { lastI = ci; if (p > 0.55 && p < 0.95) sfx.tick(); }
      W.draw();
    });
    W.rot = r1; W.ball = b1; W.br = 0; W.n = n; W.draw();
  };
  W.show = n => { const idx = WHEEL_ORDER.indexOf(n); W.ball = W.rot + idx * step - Math.PI / 2; W.br = 0; W.n = n; W.draw(); };
  W.draw();
  return W;
}
const RL_OUT = [['low', '1 to 18'], ['even', 'Even'], ['red', ''], ['black', ''], ['odd', 'Odd'], ['high', '19 to 36']];
function rouletteTable(onSpot) {
  const T = h('div', { class: 'rtable' }), spots = {};
  const add = (k, label, cls, style) => { const e = h('div', { class: 'rs ' + (cls || ''), 'data-k': k, style, onclick: ev => onSpot(k, ev) }, h('span', { class: 'rl' }, label)); spots[k] = e; T.append(e); return e; };
  add('n0', '0', 'zero g', { gridColumn: '1', gridRow: '1 / span 3' });
  for (let cc = 0; cc < 12; cc++) for (let rr = 0; rr < 3; rr++) { const n = 3 * (cc + 1) - rr; add('n' + n, String(n), 'num ' + numCol(n), { gridColumn: String(cc + 2), gridRow: String(rr + 1) }); }
  ['c3', 'c2', 'c1'].forEach((k, rr) => add(k, '2 to 1', 'out', { gridColumn: '14', gridRow: String(rr + 1) }));
  ['d1', 'd2', 'd3'].forEach((k, i) => add(k, ['1st 12', '2nd 12', '3rd 12'][i], 'out', { gridColumn: (2 + i * 4) + ' / span 4', gridRow: '4' }));
  RL_OUT.forEach(([k, l], i) => add(k, l, 'out ' + (k === 'red' ? 'redd' : k === 'black' ? 'blackd' : ''), { gridColumn: (2 + i * 2) + ' / span 2', gridRow: '5' }));
  const R = { el: T, spots };
  R.paint = (bets, mine) => {           // bets: {k: amount} (pending), mine: {k: amount} (already placed, live)
    for (const k in spots) {
      const e = spots[k]; e.querySelectorAll('.stack').forEach(x => x.remove());
      const a = (bets && bets[k]) || 0, m = (mine && mine[k]) || 0;
      if (m) e.append(h('span', { class: 'stack placed' }, chipEl(m, 's')));
      if (a) e.append(h('span', { class: 'stack' + (m ? ' two' : '') }, chipEl(a, 's')));
    }
  };
  R.mark = n => { for (const k in spots) spots[k].classList.toggle('hit', n != null && rouletteWins(k, n)); };
  return R;
}
function rouletteWins(k, n) {
  if (k[0] === 'n') return +k.slice(1) === n; if (n === 0) return false;
  return k === 'red' ? REDS.has(n) : k === 'black' ? !REDS.has(n) : k === 'odd' ? n % 2 === 1 : k === 'even' ? n % 2 === 0 : k === 'low' ? n <= 18 : k === 'high' ? n >= 19 : k[0] === 'd' ? Math.ceil(n / 12) === +k[1] : k[0] === 'c' ? ((n - 1) % 3) + 1 === +k[1] : false;
}
// chips on a layout: placed one click at a time, undo, clear, repeat
function chipBook(id, onPaint) {
  const B = { bets: {}, hist: [], last: store.get('last:' + id, null) };
  B.total = () => Object.values(B.bets).reduce((t, a) => t + a, 0);
  B.add = (k, a) => { if (!(a > 0)) return; B.bets[k] = (B.bets[k] || 0) + a; B.hist.push([k, a]); sfx.chip(); onPaint(); };
  B.undo = () => { const x = B.hist.pop(); if (!x) return; B.bets[x[0]] -= x[1]; if (B.bets[x[0]] <= 0) delete B.bets[x[0]]; sfx.chip(); onPaint(); };
  B.clear = () => { B.bets = {}; B.hist = []; onPaint(); };
  B.repeat = () => { if (!B.last) return toast('Nothing to repeat yet.'); B.clear(); for (const k in B.last) B.add(k, B.last[k]); };
  B.remember = () => { B.last = Object.assign({}, B.bets); store.set('last:' + id, B.last); };
  B.list = () => Object.entries(B.bets).filter(([, a]) => a > 0).map(([k, a]) => ({ k, a }));
  return B;
}

// ---------- Blackjack ----------
defGame({ id: 'bj', title: 'Blackjack', group: 'table', icon: '🃏', c1: '#1b7a50', c2: '#0b3d29', blurb: 'Beat the dealer to 21', hint: 'H hit · S stand · D double · P split',
  mount(opt) {
    const def = this, F = gameFrame(def, payTable('Blackjack pays', [['Blackjack', '3 : 2 (2.5x back)'], ['Win', '1 : 1 (2x back)'], ['Push', 'stake back'], ['Insurance', 'none']], 'Dealer stands on all 17s. Double on any two cards; split one pair once.'));
    const dealerRow = h('div', { class: 'crow' }), dv = h('span', { class: 'vbadge' }), hands = h('div', { class: 'hands' }), msg = h('div', { class: 'tmsg' }, 'Place your bet and deal.');
    F.main.append(h('div', { class: 'felt bjfelt' }, h('div', { class: 'bj-d' }, h('div', { class: 'lbl' }, 'Dealer ', dv), dealerRow), msg, h('div', { class: 'bj-arc' }, 'BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17'), hands));
    let V = null, busyHand = false;
    const btn = (k, t, key) => h('button', { class: 'btn act lockable', 'data-a': k, title: t + ' (' + key + ')', onclick: () => play(k) }, t);
    const acts = h('div', { class: 'acts' }, btn('hit', 'Hit', 'H'), btn('stand', 'Stand', 'S'), btn('double', 'Double', 'D'), btn('split', 'Split', 'P'));
    const bar = betBar(def, { label: 'Deal', go: deal, extra: [acts] }); F.bar.append(bar.el);
    function refresh() {
      const inHand = V && !V.over; bar.prim.classList.toggle('hidden', !!inHand); acts.classList.toggle('hidden', !inHand);
      $$('[data-a]', acts).forEach(b => { b.disabled = !inHand || !V.can.includes(b.dataset.a); });
    }
    async function syncRow(row, cards, hole) {
      for (let i = 0; i < cards.length; i++) { const el = row.children[i]; if (!el) await dealCard(row, cards[i]); else if (el.classList.contains('down')) await flipUp(el, cards[i]); }
      if (hole && row.children.length < 2) await dealCard(row, null, true);
    }
    function handBox(hd, i) { return h('div', { class: 'hand', 'data-i': i }, h('div', { class: 'crow' }), h('div', { class: 'hinfo' }, h('span', { class: 'vbadge' }), h('span', { class: 'hbet' }, chipEl(hd.bet, 's'), ' ' + fmt(hd.bet)))); }
    async function show(v, quick) {
      V = v;
      if (hands.children.length !== v.hands.length) {           // a split: rebuild with the first card of each hand
        hands.innerHTML = ''; v.hands.forEach((hd, i) => { const b = handBox(hd, i); hands.append(b); b.querySelector('.crow').append(cardEl(hd.cards[0])); });
      }
      const doDeal = async () => {
        for (let i = 0; i < v.hands.length; i++) {
          const hd = v.hands[i], box = hands.children[i];
          box.classList.toggle('active', !v.over && v.active === i && v.hands.length > 1);
          box.querySelector('.hbet').lastChild.textContent = ' ' + fmt(hd.bet); box.querySelector('.hbet .chip').replaceWith(chipEl(hd.bet, 's'));
          await syncRow(box.querySelector('.crow'), hd.cards);
          box.querySelector('.vbadge').textContent = hd.v + (hd.v > 21 ? ' BUST' : hd.cards.length === 2 && hd.v === 21 && v.hands.length === 1 ? ' BJ' : '');
          box.classList.toggle('bust', hd.v > 21);
        }
        await syncRow(dealerRow, v.dealer, !v.over);
        dv.textContent = v.over ? v.dv + (v.dv > 21 ? ' BUST' : '') : bjValue(v.dealer);
      };
      if (quick) { S.instant = true; try { await doDeal(); } finally { S.instant = false; } } else await doDeal();
    }
    async function deal() {
      if (V && !V.over) return;
      await act(async () => {
        const bet = bar.bet, rep = await call('bj', { act: 'deal', bet }, { hold: true });
        dealerRow.innerHTML = ''; hands.innerHTML = ''; dv.textContent = ''; msg.textContent = '';
        const v = rep.r.view; V = v; refresh();
        await animate(async () => {               // the usual order: player, dealer, player, dealer (face down)
          const hb = handBox(v.hands[0], 0); hands.append(hb); const pr = hb.querySelector('.crow');
          await dealCard(pr, v.hands[0].cards[0]); await dealCard(dealerRow, v.dealer[0]); await dealCard(pr, v.hands[0].cards[1]);
          if (v.over && v.dealer.length > 1) await dealCard(dealerRow, null, true); else if (!v.over) await dealCard(dealerRow, null, true);
          await show(v);
        });
        after(rep);
      });
    }
    async function play(a) {
      if (!V || V.over || !V.can.includes(a)) return;
      await act(async () => { const rep = await call('bj', { act: a }, { hold: true }); await animate(() => show(rep.r.view)); after(rep); });
    }
    function after(rep) {
      const v = rep.r.view; V = v;
      if (!rep.r.over) { releaseBal(); msg.textContent = v.hands.length > 1 ? 'Playing hand ' + (v.active + 1) + ' of 2' : 'Hit, stand' + (v.can.includes('double') ? ', double' : '') + (v.can.includes('split') ? ' or split' : '') + '?'; refresh(); return; }
      const lines = v.hands.map(hd => { const bj = hd.cards.length === 2 && hd.v === 21 && v.hands.length === 1; return hd.v > 21 ? 'Bust' : bj && !(v.dealer.length === 2 && v.dv === 21) ? 'Blackjack!' : v.dv > 21 ? 'Dealer busts' : hd.v > v.dv ? 'You win' : hd.v === v.dv ? 'Push' : 'Dealer wins'; });
      msg.textContent = lines.join(' · '); refresh();
      finish('bj', rep.r.bet, rep.r.win, 'Blackjack', F.main);
    }
    async function start() {
      refresh();
      try { const rep = await call('bj', { act: 'state' }); if (rep.r && rep.r.resume) { bar.bet = rep.r.bet; await show(rep.r.view, true); V = rep.r.view; V.over = false; msg.textContent = 'Your hand is back. Carry on.'; refresh(); } } catch {}
    }
    return { root: F.root, start, refresh, primary: () => (V && !V.over ? play('stand') : deal()), key: e => { const m = { h: 'hit', s: 'stand', d: 'double', p: 'split' }[e.key.toLowerCase()]; if (m) { play(m); return true; } } };
  } });
function bjValue(cards) { let t = 0, a = 0; for (const c of cards) { t += c.r === 1 ? 11 : Math.min(10, c.r); if (c.r === 1) a++; } while (t > 21 && a) { t -= 10; a--; } return t; }

// ---------- Roulette ----------
defGame({ id: 'roulette', title: 'Roulette', group: 'table', icon: '🎯', c1: '#a3202d', c2: '#3d0b12', blurb: 'European wheel, one zero', hint: 'Pick a chip, click the table, Space to spin',
  mount() {
    const def = this, F = gameFrame(def, payTable('Roulette pays', [['Straight number', '36x'], ['Dozen / Column', '3x'], ['Red / Black', '2x'], ['Odd / Even', '2x'], ['1-18 / 19-36', '2x']], 'Zero loses every outside bet. Pays are the total handed back (stake included).'));
    const W = rouletteWheel(), hist = h('div', { class: 'rhist' }), res = h('div', { class: 'rres' });
    const book = chipBook(def.id, () => { T.paint(book.bets); bar.setTotal(book.total()); });
    const T = rouletteTable(k => { if (S.busy || animating) return; T.mark(null); book.add(k, bar.chip); });
    F.main.append(h('div', { class: 'felt rfelt' }, h('div', { class: 'rw' }, W.el, res, hist), h('div', { class: 'rt' }, T.el)));
    const bar = betBar(def, { mode: 'chips', label: 'Spin', go: spin, undo: book.undo, clear: book.clear, repeat: book.repeat }); F.bar.append(bar.el);
    const past = store.get('rhist', []); const drawHist = () => { hist.innerHTML = ''; past.slice(-12).reverse().forEach(n => hist.append(h('span', { class: 'rn ' + numCol(n) }, n))); }; drawHist();
    async function spin() {
      const bets = book.list(); if (!bets.length) return toast('Put some chips on the table first.', 'err');
      await act(async () => {
        const rep = await call('roulette', { bets }, { hold: true }); book.remember(); T.mark(null); res.textContent = '';
        await animate(() => W.spinTo(rep.r.n, 5000));
        res.className = 'rres ' + numCol(rep.r.n); res.textContent = rep.r.n; T.mark(rep.r.n); past.push(rep.r.n); store.set('rhist', past.slice(-30)); drawHist();
        finish('roulette', rep.r.bet, rep.r.win, rep.r.n + ' ' + ({ r: 'red', b: 'black', g: 'green' })[numCol(rep.r.n)], F.main);
      });
    }
    return { root: F.root, primary: spin, key: e => { if (e.key === 'Backspace') { book.clear(); return true; } if (e.key.toLowerCase() === 'r') { book.repeat(); return true; } if (e.key.toLowerCase() === 'z') { book.undo(); return true; } } };
  } });

// ---------- Baccarat ----------
defGame({ id: 'baccarat', title: 'Baccarat', group: 'table', icon: '🎴', c1: '#20507a', c2: '#0b2238', blurb: 'Player, Banker or Tie',
  mount() {
    const def = this, F = gameFrame(def, payTable('Baccarat pays', [['Player', '2x'], ['Banker', '1.95x'], ['Tie', '9x (Player and Banker bets come back)']], 'Cards count face value, tens and faces 0; only the last digit counts. Third cards follow the usual tableau.'));
    const rows = { p: h('div', { class: 'crow' }), b: h('div', { class: 'crow' }) }, tot = { p: h('span', { class: 'vbadge' }), b: h('span', { class: 'vbadge' }) };
    const book = chipBook(def.id, paint), spots = {};
    const spot = (k, t, pay) => spots[k] = h('div', { class: 'bspot b-' + k, onclick: () => { if (!S.busy && !animating) book.add(k, bar.chip); } }, h('b', null, t), h('small', null, pay), h('span', { class: 'sc' }));
    F.main.append(h('div', { class: 'felt bacfelt' },
      h('div', { class: 'bac-hands' }, h('div', { class: 'bac-h' }, h('div', { class: 'lbl' }, 'PLAYER ', tot.p), rows.p), h('div', { class: 'bac-h' }, h('div', { class: 'lbl' }, 'BANKER ', tot.b), rows.b)),
      h('div', { class: 'bac-spots' }, spot('p', 'PLAYER', 'pays 2x'), spot('t', 'TIE', 'pays 9x'), spot('b', 'BANKER', 'pays 1.95x'))));
    const bar = betBar(def, { mode: 'chips', label: 'Deal', go: deal, undo: book.undo, clear: book.clear, repeat: book.repeat }); F.bar.append(bar.el);
    function paint() { for (const k in spots) { const sc = spots[k].querySelector('.sc'); sc.innerHTML = ''; if (book.bets[k]) sc.append(chipEl(book.bets[k])); spots[k].classList.remove('hit'); } bar.setTotal(book.total()); }
    const bv = cs => cs.reduce((t, c) => t + (c.r >= 10 ? 0 : c.r), 0) % 10;
    async function deal() {
      if (!book.total()) return toast('Put chips on Player, Banker or Tie.', 'err');
      await act(async () => {
        const b = { p: book.bets.p || 0, b: book.bets.b || 0, t: book.bets.t || 0 };
        const rep = await call('baccarat', { bets: b }, { hold: true }), r = rep.r; book.remember();
        rows.p.innerHTML = rows.b.innerHTML = ''; tot.p.textContent = tot.b.textContent = '';
        await animate(async () => {
          const order = [['p', 0], ['b', 0], ['p', 1], ['b', 1]]; if (r.P[2]) order.push(['p', 2]); if (r.B[2]) order.push(['b', 2]);
          for (const [s, i] of order) { const cs = s === 'p' ? r.P : r.B; await dealCard(rows[s], cs[i]); tot[s].textContent = bv(cs.slice(0, i + 1)); if (i === 1) await wait(200); }
        });
        spots[r.res].classList.add('hit');
        finish('baccarat', r.bet, r.win, r.res === 'p' ? 'Player wins ' + r.pt + '-' + r.bt : r.res === 'b' ? 'Banker wins ' + r.bt + '-' + r.pt : 'Tie ' + r.pt + '-' + r.bt, F.main);
      });
    }
    return { root: F.root, primary: deal, key: e => { if (e.key.toLowerCase() === 'r') { book.repeat(); return true; } if (e.key === 'Backspace') { book.clear(); return true; } } };
  } });

// ---------- Craps ----------
defGame({ id: 'craps', title: 'Craps', group: 'table', icon: '🎲', c1: '#6a3b9e', c2: '#2a1442', blurb: 'Pass or Don\'t Pass',
  mount() {
    const def = this, F = gameFrame(def, payTable('Craps (Pass Line)', [['Come-out 7 or 11', 'Pass wins'], ['Come-out 2, 3, 12', 'Don\'t Pass wins (12 = push)'], ['Point, then point again', 'Pass wins'], ['Point, then 7', 'Don\'t Pass wins'], ['Win pays', '2x']], 'One bet runs until it is decided; the dice keep rolling for you.'));
    let side = store.get('craps:side', 'pass');
    const d1 = dieEl(3), d2 = dieEl(4), pts = h('div', { class: 'points' }), log = h('div', { class: 'rolls' }), msg = h('div', { class: 'tmsg' }, 'Pick a side and roll.');
    [4, 5, 6, 8, 9, 10].forEach(p => pts.append(h('div', { class: 'pt', 'data-p': p }, p === 6 ? 'SIX' : p === 9 ? 'NINE' : p)));
    const sides = { pass: h('div', { class: 'cside', onclick: () => setSide('pass') }, h('b', null, 'PASS LINE'), h('small', null, 'with the shooter')), dont: h('div', { class: 'cside', onclick: () => setSide('dont') }, h('b', null, 'DON\'T PASS'), h('small', null, 'against the shooter')) };
    function setSide(s) { side = s; store.set('craps:side', s); sides.pass.classList.toggle('sel', s === 'pass'); sides.dont.classList.toggle('sel', s === 'dont'); sfx.chip(); }
    F.main.append(h('div', { class: 'felt crfelt' }, pts, h('div', { class: 'dicebox' }, d1, d2), msg, log, h('div', { class: 'csides' }, sides.pass, sides.dont)));
    setSide(side);
    const bar = betBar(def, { label: 'Roll', go: roll }); F.bar.append(bar.el);
    async function roll() {
      await act(async () => {
        const rep = await call('craps', { bet: bar.bet, side }, { hold: true }), r = rep.r; log.innerHTML = ''; $$('.pt', pts).forEach(p => p.classList.remove('on'));
        await animate(async () => {
          for (let i = 0; i < r.rolls.length; i++) {
            const d = r.rolls[i], s = d[0] + d[1];
            await tumble([d1, d2], d, i === 0 ? 800 : r.rolls.length > 12 ? 300 : 550);
            log.append(h('span', { class: 'rl' + (s === 7 ? ' seven' : s === r.point ? ' point' : '') }, s));
            if (i === 0 && r.point) { const p = pts.querySelector(`[data-p="${r.point}"]`); p && p.classList.add('on'); msg.textContent = 'The point is ' + r.point + '. Rolling for ' + r.point + ' before a 7…'; }
            else if (i === 0) msg.textContent = s === 7 || s === 11 ? 'Natural ' + s + '!' : 'Craps: ' + s;
            await wait(r.rolls.length > 12 ? 120 : 260);
          }
        });
        const last = r.rolls[r.rolls.length - 1]; if (r.point) msg.textContent = (r.pass ? 'Made the point ' + r.point : 'Seven out') + ' after ' + r.rolls.length + ' rolls.';
        finish('craps', r.bet, r.win, (r.pass ? 'Pass' : 'Don\'t Pass') + ' wins', F.main);
      });
    }
    return { root: F.root, primary: roll };
  } });

// ---------- Sic Bo ----------
const SB_TOT = { 4: 61, 17: 61, 5: 31, 16: 31, 6: 18, 15: 18, 7: 13, 14: 13, 8: 9, 13: 9, 9: 7, 12: 7, 10: 7, 11: 7 };
function sicboWins(k, d) { const t = d[0] + d[1] + d[2], trip = d[0] === d[1] && d[1] === d[2]; if (k === 'big') return !trip && t >= 11; if (k === 'small') return !trip && t <= 10; if (k === 'odd') return !trip && t % 2 === 1; if (k === 'even') return !trip && t % 2 === 0; if (k === 'triple') return trip; if (k[0] === 't') return t === +k.slice(1); return d.includes(+k[1]); }
defGame({ id: 'sicbo', title: 'Sic Bo', group: 'table', icon: '🧧', c1: '#b5532a', c2: '#43180a', blurb: 'Three dice, many bets',
  mount() {
    const def = this, F = gameFrame(def, payTable('Sic Bo pays', [['Small 4-10 / Big 11-17', '2x (not on a triple)'], ['Odd / Even', '2x (not on a triple)'], ['Any triple', '31x'], ['Total 4 or 17', '61x'], ['Total 5 or 16', '31x'], ['Total 6 or 15', '18x'], ['Total 7 or 14', '13x'], ['Total 8 or 13', '9x'], ['Total 9-12', '7x'], ['A face', '2x / 3x / 4x for 1 / 2 / 3 dice']]));
    const book = chipBook(def.id, paint), spots = {}, dice = [dieEl(1), dieEl(3), dieEl(6)], tot = h('div', { class: 'sbtot' }, '');
    const sp = (k, t, s, cls) => spots[k] = h('div', { class: 'sbs ' + (cls || ''), onclick: () => { if (!S.busy && !animating) book.add(k, bar.chip); } }, h('b', { html: t }), s ? h('small', null, s) : null, h('span', { class: 'sc' }));
    const r1 = h('div', { class: 'sbrow r1' }, sp('small', 'SMALL', '4-10 · 2x'), sp('odd', 'ODD', '2x'), sp('triple', 'ANY TRIPLE', '31x', 'trip'), sp('even', 'EVEN', '2x'), sp('big', 'BIG', '11-17 · 2x'));
    const r2 = h('div', { class: 'sbrow r2' }); for (let t = 4; t <= 17; t++) r2.append(sp('t' + t, String(t), SB_TOT[t] + 'x'));
    const r3 = h('div', { class: 'sbrow r3' }); for (let f = 1; f <= 6; f++) { const e = sp('s' + f, '', '2-4x'); e.querySelector('b').append(dieEl(f, 'mini')); r3.append(e); }
    F.main.append(h('div', { class: 'felt sbfelt' }, h('div', { class: 'dicebox' }, ...dice, tot), h('div', { class: 'sbtable' }, r1, r2, r3)));
    const bar = betBar(def, { mode: 'chips', label: 'Roll', go: roll, undo: book.undo, clear: book.clear, repeat: book.repeat }); F.bar.append(bar.el);
    function paint() { for (const k in spots) { const sc = spots[k].querySelector('.sc'); sc.innerHTML = ''; if (book.bets[k]) sc.append(chipEl(book.bets[k], 's')); spots[k].classList.remove('hit'); } bar.setTotal(book.total()); }
    async function roll() {
      const bets = book.list(); if (!bets.length) return toast('Put some chips on the table first.', 'err');
      await act(async () => {
        const rep = await call('sicbo', { bets }, { hold: true }), r = rep.r; book.remember(); tot.textContent = '';
        await animate(() => tumble(dice, r.d, 1100));
        tot.textContent = r.total; for (const k in spots) spots[k].classList.toggle('hit', sicboWins(k, r.d));
        finish('sicbo', r.bet, r.win, r.d.join(' · ') + ' = ' + r.total, F.main);
      });
    }
    return { root: F.root, primary: roll, key: e => { if (e.key.toLowerCase() === 'r') { book.repeat(); return true; } if (e.key === 'Backspace') { book.clear(); return true; } } };
  } });

// ---------- Video Poker ----------
defGame({ id: 'vp', title: 'Video Poker', group: 'table', icon: '♠️', c1: '#2741a0', c2: '#0e1740', blurb: 'Jacks or Better',
  mount() {
    const def = this, VPT = (S.tables && S.tables.vp) || [];
    const pt = payTable('Jacks or Better', VPT.map(([n, m]) => [n, m + 'x', n]), 'Click a card (or press 1-5) to hold it, then draw.');
    const F = gameFrame(def, pt);
    const row = h('div', { class: 'vprow' }), rank = h('div', { class: 'vprank' }, 'Deal to start');
    F.main.append(h('div', { class: 'felt vpfelt' }, h('div', { class: 'vpscreen' }, rank, row, h('div', { class: 'small center' }, 'Click the cards you want to keep'))));
    let hand = null, hold = new Set(), live = false;
    for (let i = 0; i < 5; i++) { const c = cardEl(null, true); c.dataset.i = i; c.onclick = () => toggle(i); row.append(c); }
    const bar = betBar(def, { label: 'Deal', go: () => (live ? draw() : deal()) }); F.bar.append(bar.el);
    function toggle(i) { if (!live || S.busy) return; if (hold.has(i)) hold.delete(i); else hold.add(i); row.children[i].classList.toggle('held', hold.has(i)); sfx.click(); }
    function lightRank(name) { $$('tr', pt).forEach(tr => tr.classList.toggle('lit', tr.dataset.k === name)); }
    function refresh() { bar.label(live ? 'Draw' : 'Deal'); }
    async function deal() {
      await act(async () => {
        const rep = await call('vp', { act: 'deal', bet: bar.bet }); hand = rep.r.view.hand; hold.clear(); live = true; lightRank(null);
        await animate(async () => { for (let i = 0; i < 5; i++) { const c = row.children[i]; c.classList.remove('held', 'glow', 'dim'); c.classList.add('down'); } await wait(150); for (let i = 0; i < 5; i++) await flipUp(row.children[i], hand[i]); });
        rank.textContent = rep.r.view.rank !== 'Nothing' ? rep.r.view.rank + ' (hold it!)' : 'Choose cards to hold'; lightRank(rep.r.view.rank); refresh();
      });
    }
    async function draw() {
      await act(async () => {
        const rep = await call('vp', { act: 'draw', hold: [...hold] }, { hold: true }), v = rep.r.view; live = false;
        await animate(async () => { for (let i = 0; i < 5; i++) if (!hold.has(i)) { row.children[i].classList.add('down'); } await wait(200); for (let i = 0; i < 5; i++) if (!hold.has(i)) await flipUp(row.children[i], v.hand[i]); });
        for (let i = 0; i < 5; i++) row.children[i].classList.remove('held');
        rank.textContent = v.rank === 'Nothing' ? 'No win' : v.rank + ' · ' + v.mult + 'x'; lightRank(v.rank); refresh();
        finish('vp', rep.r.bet, rep.r.win, v.rank, F.main);
      });
    }
    async function start() { refresh(); try { const rep = await call('vp', { act: 'state' }); if (rep.r && rep.r.resume) { bar.bet = rep.r.bet; hand = rep.r.view.hand; live = true; hand.forEach((c, i) => { setCard(row.children[i], c); row.children[i].classList.remove('down'); }); rank.textContent = 'Your hand is back: hold and draw'; refresh(); } } catch {} }
    return { root: F.root, start, refresh, primary: () => (live ? draw() : deal()), key: e => { if (/^[1-5]$/.test(e.key)) { toggle(+e.key - 1); return true; } } };
  } });
