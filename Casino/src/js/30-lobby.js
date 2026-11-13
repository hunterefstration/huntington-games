// The floor: the lobby with every game, the cage (buy chips / cash out), the free daily spin, the odds page, settings.
let view = null;                                       // { kind, id, cleanup }

function clearView() {
  skipGen++;
  if (S.game) { try { S.game.unmount && S.game.unmount(); } catch (e) { console.error(e); } }
  if (view && view.cleanup) try { view.cleanup(); } catch {}
  S.game = null; view = null; $('#main').innerHTML = ''; releaseBal();
}
function openLobby() {
  clearView(); document.body.classList.add('at-lobby'); view = { kind: 'lobby' };
  const root = h('div', { class: 'lobby' });
  const ticker = h('div', { class: 'ticker' }, h('span', { class: 'tk-l' }, '🏆 Big wins'), h('div', { class: 'tk-w' }, h('div', { class: 'tk-in', id: 'tk-in' })));
  const left = h('div', { class: 'lb-left' });
  if (S.turn && gameById(S.turn.g)) {
    const g = gameById(S.turn.g);
    left.append(h('div', { class: 'resume' }, h('span', null, '⏸ You have an unfinished ', h('b', null, g.title), ' hand (' + fmt(S.turn.bet) + ' chips).'), h('button', { class: 'btn gold sm', onclick: () => openGame(g.id, true) }, 'Resume your hand')));
  }
  for (const grp of Object.keys(GROUPS)) {
    const grid = h('div', { class: 'tiles' });
    for (const g of GAMES.filter(x => x.group === grp)) {
      const st = h('span', { class: 'tl-st', 'data-live': g.id });
      grid.append(h('button', { class: 'tile', style: { '--c1': g.c1 || '#3a3f7a', '--c2': g.c2 || '#1f2347' }, onclick: () => openGame(g.id), 'data-g': g.id },
        h('span', { class: 'tl-ico' }, g.icon), h('span', { class: 'tl-t' }, g.title),
        h('span', { class: 'tl-s' }, g.blurb || ''), grp === 'live' ? h('span', { class: 'tl-live' }, 'LIVE') : null, st));
    }
    left.append(h('h3', { class: 'grp' }, GROUPS[grp], grp === 'live' ? h('small', null, ' shared rounds on the server clock, with everyone in the casino') : null), grid);
  }
  const st = S.stats;
  const right = h('div', { class: 'lb-right' },
    h('div', { class: 'panel daily' + (S.daily ? ' ready' : '') }, h('h3', null, '🎁 Free daily spin'),
      h('p', null, S.daily ? 'Spin the wheel once a day for free chips (20 to 500).' : 'You had today\'s spin. Come back tomorrow.'),
      h('button', { class: 'btn ' + (S.daily ? 'gold' : ''), disabled: !S.daily, onclick: dailySpin }, S.daily ? 'Spin for free' : 'Done for today')),
    h('div', { class: 'panel' }, h('h3', null, '📊 Your stats'),
      h('div', { class: 'stats' }, stat('Plays', fmt(st.plays)), stat('Wagered', fmt(st.wag)), stat('Won back', fmt(st.won)), stat('Biggest win', '+' + fmt(st.big)))),
    h('div', { class: 'panel' }, h('h3', null, '🏦 The cage'), h('p', { class: 'small' }, h('b', null, '1 goon = 100 chips.'), ' Buy chips with goons and cash them back any time at the same rate.'),
      h('div', { class: 'mrow' }, h('button', { class: 'btn gold sm', onclick: () => cage('buy') }, 'Buy chips'), h('button', { class: 'btn sm', onclick: () => cage('cash') }, 'Cash out'), h('button', { class: 'btn sm', onclick: openOdds }, 'The odds'))),
    h('div', { class: 'panel feedp' }, h('h3', null, '✨ Recent big wins'), h('div', { class: 'feedl', id: 'feedl' })));
  root.append(ticker, h('div', { class: 'lb-cols' }, left, right));
  $('#main').append(root);
  drawFeed();
  const iv = setInterval(liveTiles, 500); liveTiles();
  view.cleanup = () => clearInterval(iv);
}
const stat = (k, v) => h('div', { class: 'stat' }, h('small', null, k), h('b', { class: 'num' }, v));
const gName = g => S.names[g] || (gameById(g) || {}).title || g;
function feedText(it) { return h('span', { class: 'fi' }, h('b', null, it.n), ' won ', h('b', { class: 'gold' }, fmt(it.win)), ' on ' + gName(it.g) + (it.bet ? ' (' + fmtX(it.win / it.bet) + ')' : '')); }
function drawFeed() {
  const items = S.feed.slice(-15).reverse(), tk = $('#tk-in'), fl = $('#feedl');
  if (tk) { tk.innerHTML = ''; if (!items.length) tk.append(h('span', { class: 'fi' }, 'No big wins yet today. Could be you.')); items.forEach(it => tk.append(feedText(it))); tk.style.animationDuration = Math.max(20, items.length * 6) + 's'; }
  if (fl) { fl.innerHTML = ''; if (!items.length) fl.append(h('p', { class: 'small' }, 'Wins of 10x or 800+ chips show up here.')); items.slice(0, 8).forEach(it => fl.append(h('div', null, feedText(it), h('small', null, ago(it.at))))); }
}
function feedChanged(it) { drawFeed(); if (view && view.kind === 'lobby' && it) sfx.coin(); }
const ago = t => { const s = Math.max(0, (now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : Math.floor(s / 3600) + ' h ago'; };
function liveTiles() {
  const L = S.live; if (!L) return;
  for (const el of $$('[data-live]')) {
    const id = el.dataset.live; let t = '';
    if (id === 'lr' || id === 'race' || id === 'crash') {
      const T = L[id === 'race' ? 'race' : id], p = phase(T);
      t = p.left > 0 ? (id === 'crash' ? 'Boarding · ' : 'Betting · ') + secs(p.left) + 's' : (id === 'lr' ? 'Spinning' : id === 'race' ? 'Racing' : 'In flight') + ' · next in ' + secs(p.toNext) + 's';
      el.classList.toggle('open', p.left > 0);
    } else if (id === 'pot') { const p = phase(L.pot), s = secs(p.left); t = 'Draw in ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + (L.pot.total ? ' · ' + fmt(L.pot.total) + ' in' : ''); el.classList.toggle('open', p.left > 0); }
    else if (id === 'duel') { const n = (L.duels || []).length; t = n ? n + ' open duel' + (n > 1 ? 's' : '') : 'No open duels'; el.classList.toggle('open', n > 0); }
    el.textContent = t;
  }
}

// ---------- the cage ----------
function cage(kind) {
  const rate = S.limits.rate || 100, buy = kind === 'buy', dev = S.bal.goons < 0;
  const maxG = buy ? (dev ? 10000 : S.bal.goons) : Math.floor(S.bal.chips / rate);
  let n = Math.min(maxG, buy ? 10 : Math.max(1, Math.floor(maxG / 2))) || 0;
  const inp = h('input', { class: 'inp num', type: 'number', min: 1, max: maxG, value: n, oninput: () => { n = Math.floor(+inp.value) || 0; upd(); } });
  const out = h('p', { class: 'cg-out' }), go = h('button', { class: 'btn gold big', onclick: () => doIt() });
  const quick = [1, 5, 10, 25, 50, 100].filter(q => q <= maxG).map(q => h('button', { class: 'btn sm', onclick: () => { n = q; inp.value = q; upd(); } }, q));
  if (maxG > 0 && !dev) quick.push(h('button', { class: 'btn sm', onclick: () => { n = maxG; inp.value = maxG; upd(); } }, 'All (' + fmt(maxG) + ')'));
  function upd() {
    const okN = n >= 1 && n <= maxG;
    out.innerHTML = okN ? (buy ? `Pay <b>${fmt(n)} goon${n === 1 ? '' : 's'}</b>, get <b class="gold">${fmt(n * rate)} chips</b>.` : `Hand in <b class="gold">${fmt(n * rate)} chips</b>, get <b>${fmt(n)} goon${n === 1 ? '' : 's'}</b> back.`) : (maxG < 1 ? (buy ? 'You have no goons to swap.' : 'You need at least ' + rate + ' chips to cash out 1 goon.') : 'Pick 1 to ' + fmt(maxG) + '.');
    go.disabled = !okN; go.textContent = buy ? 'Buy ' + (okN ? fmt(n * rate) + ' chips' : 'chips') : 'Cash out ' + (okN ? fmt(n) + ' goon' + (n === 1 ? '' : 's') : '');
  }
  async function doIt() {
    if (go.disabled) return; go.disabled = true;
    await act(async () => { await call(kind, { goons: n }); sfx.chip(); sfx.coin(); toast(buy ? 'Bought ' + fmt(n * rate) + ' chips' : 'Cashed out ' + fmt(n) + ' goon' + (n === 1 ? '' : 's'), 'win'); closeModal(); if (view && view.kind === 'lobby') openLobby(); });
    go.disabled = false;
  }
  modal(h('h2', null, buy ? '🏦 Buy chips' : '🏦 Cash out'),
    h('p', null, h('b', { class: 'gold' }, '1 goon = ' + rate + ' chips'), ' both ways. ', buy ? (dev ? 'Developer: unlimited goons.' : 'You have ' + fmt(S.bal.goons) + ' goons.') : 'You have ' + fmt(S.bal.chips) + ' chips.'),
    h('div', { class: 'mrow' }, h('span', null, 'Goons:'), inp, ...quick), out,
    h('p', { class: 'small' }, 'Play money only: goons and chips cannot be bought with or swapped for real money or anything outside Huntington Games.'),
    h('div', { class: 'mrow end' }, h('button', { class: 'btn', onclick: closeModal }, 'Cancel'), go));
  upd(); inp.focus(); inp.select();
}

// ---------- the free daily spin ----------
const PRIZE_COL = ['#e2434b', '#2b6fe0', '#1c9a55', '#d9951a', '#8a3bd1', '#0fa3a3'];
function drawPrizeWheel(cv, prizes, rot) {
  const c = cv.getContext('2d'), W = cv.width, R = W / 2 - 6, n = prizes.length; c.clearRect(0, 0, W, W);
  c.save(); c.translate(W / 2, W / 2); c.rotate(rot);
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (i - 0.5) * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a1); c.closePath(); c.fillStyle = PRIZE_COL[i % PRIZE_COL.length]; c.fill(); c.strokeStyle = '#fff6'; c.lineWidth = 2; c.stroke();
    c.save(); c.rotate((a0 + a1) / 2); c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(W / 16) + 'px system-ui'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(prizes[i], R - 10, 0); c.restore();
  }
  c.beginPath(); c.arc(0, 0, R * 0.16, 0, 7); c.fillStyle = '#f6c446'; c.fill(); c.restore();
  c.beginPath(); c.arc(W / 2, W / 2, R, 0, 7); c.strokeStyle = '#f6c446'; c.lineWidth = 6; c.stroke();
}
function dailySpin() {
  const prizes = [20, 20, 30, 30, 40, 50, 50, 75, 100, 150, 250, 500];
  const cv = h('canvas', { width: 320, height: 320, class: 'dwheel' }); let rot = 0;
  const btn = h('button', { class: 'btn gold big', onclick: spin }, 'Spin!');
  const res = h('p', { class: 'cg-out' }, 'Twelve prizes, one free spin a day.');
  modal(h('h2', null, '🎁 Free daily spin'), h('div', { class: 'dwrap' }, cv, h('div', { class: 'dptr' }, '▼')), res, h('div', { class: 'mrow end' }, h('button', { class: 'btn', onclick: closeModal }, 'Close'), btn));
  drawPrizeWheel(cv, prizes, 0);
  async function spin() {
    btn.disabled = true;
    await act(async () => {
      const rep = await call('daily', {}, { hold: false }); S.hold = rep.bal.chips - rep.win; drawBal(); S.daily = false;
      const P = rep.prizes || prizes, target = -rep.slice * 2 * Math.PI / P.length, start = rot, end = target - 2 * Math.PI * 6;
      sfx.spin(); let lastTick = 0;
      await animate(() => tween(4200, e => { rot = start + (end - start) * e; drawPrizeWheel(cv, P, rot); const k = Math.floor(rot * P.length / (2 * Math.PI)); if (k !== lastTick) { lastTick = k; sfx.tick(); } }));
      releaseBal(); res.innerHTML = `You won <b class="gold">${fmt(rep.win)} chips</b>. See you tomorrow!`; sfx.win(rep.win >= 150); toast('Free spin: +' + fmt(rep.win) + ' chips', 'win');
      S.stats.won += 0; announce({ g: 'daily', bet: 0, win: rep.win, chips: S.bal.chips });
    });
    btn.textContent = 'Done for today';
  }
}

// ---------- how it works / the odds ----------
const HOW = {
  bj: 'Beat the dealer without going over 21. Blackjack pays 3:2, a win 1:1. Double and split allowed.',
  roulette: 'European wheel, one zero. A number pays 36x, dozens and columns 3x, red/black, odd/even, low/high 2x.',
  baccarat: 'Bet on Player (2x), Banker (1.95x) or Tie (9x, and Player/Banker bets come back).',
  craps: 'Pass wins on 7 or 11 and loses on 2, 3, 12; otherwise roll the point again before a 7. Pays 2x. Don\'t Pass is the other side (12 is a push).',
  sicbo: 'Three dice. Big/Small/Odd/Even pay 2x (but lose on a triple), totals 7x to 61x, any triple 31x, a face 2x to 4x.',
  vp: 'Jacks or Better: deal five, hold what you like, draw once. Pays from a pair of Jacks (1x) to a Royal Flush (250x).',
  slots: 'Three reels, five lines. Three of a kind on a line pays; the joker is wild; two cherries from the left pay a little.',
  plinko: 'Drop a ball through rows of pegs. Edges pay most and are rare; choose 8, 12 or 16 rows and a risk level.',
  wheel: 'Sixty slices from 0x to 10x. Spin and see where it stops.',
  keno: 'Pick 1 to 10 numbers of 40; ten are drawn. The more you catch, the more it pays.',
  scratch: 'Buy a card and scratch nine boxes: three of the same symbol wins that prize.',
  mines: 'Open tiles on a 5x5 grid without hitting a mine. Every safe tile raises the multiplier; cash out any time.',
  hilo: 'Guess if the next card is higher or lower. The less likely guess pays more; cash out any time. The same card again is a free redo.',
  dice: 'Pick a number and over or under. The smaller your chance, the bigger the pay (99 / chance).',
  coin: 'Heads or tails. Pays 1.96x.',
  crashx: 'Pick a cash-out point; if the rocket reaches it before it blows up, you win that multiple.',
  lr: 'Roulette with everyone: bet during the countdown, the wheel spins for the whole room.',
  crash: 'Board the rocket during the countdown, then cash out before it blows up. Everyone flies together.',
  race: 'Six horses, fixed odds. Back one or more during the countdown and watch the race.',
  pot: 'Throw chips in the pot; the winner takes 97% of it. Your chance is your share of the pot.',
  duel: 'Open a duel or take someone\'s: a coin flip for both stakes, the winner gets 97%.'
};
function openOdds() {
  clearView(); document.body.classList.remove('at-lobby'); view = { kind: 'odds' };
  const ids = Object.keys(HOW).filter(k => S.edge[k] != null || !Object.keys(S.edge).length);
  const rows = ids.map(k => h('tr', null, h('td', null, h('b', null, gName(k))), h('td', { class: 'num' }, S.edge[k] != null ? S.edge[k] + '%' : '–'), h('td', { class: 'num' }, S.edge[k] != null ? (100 - S.edge[k]).toFixed(1) + '%' : '–'), h('td', null, HOW[k])));
  $('#main').append(h('div', { class: 'odds' }, h('div', { class: 'odds-in' },
    h('h2', null, '❓ How it works and the odds'),
    h('div', { class: 'warn' }, h('b', null, 'Play money only. '), 'Goons and chips are a toy currency for Huntington Games. They have no real-money value and cannot be bought, sold, or cashed out for money or anything outside the games.'),
    h('ul', null,
      h('li', null, h('b', null, '1 goon = ' + (S.limits.rate || 100) + ' chips'), ', both ways, at the cage (top right).'),
      h('li', null, 'Bets are ' + S.limits.min + ' to ' + fmt(S.limits.max) + ' chips. Every result is decided on the Grapevine server, never in this page.'),
      h('li', null, 'Every game has a ', h('b', null, 'house edge'), ': the share of each chip bet the casino keeps on average. Over many plays you get back the "returns" figure, so in the long run the house wins.'),
      h('li', null, 'Take breaks. It is only for fun: if it stops being fun, stop.')),
    h('table', { class: 'otab' }, h('tr', null, h('th', null, 'Game'), h('th', null, 'House edge'), h('th', null, 'Returns'), h('th', null, 'How it pays')), ...rows),
    h('div', { class: 'mrow' }, h('button', { class: 'btn gold', onclick: openLobby }, 'Back to the lobby')))));
}

// ---------- settings ----------
function sw(label, on, fn) { const s = h('label', { class: 'switch' + (on ? ' on' : ''), onclick: () => { on = !on; s.classList.toggle('on', on); fn(on); } }, h('i'), label); return s; }
function setMute(v) { S.mute = v; store.set('mute', v); $('#b-mute').textContent = v ? '🔇' : '🔊'; $('#b-mute').classList.toggle('on', !v); }
function setFast(v) { S.fast = v; store.set('fast', v); $('#b-fast').classList.toggle('on', v); }
function openSettings() {
  const live = !!launcherApi();
  modal(h('h2', null, '⚙ Settings'),
    h('div', { class: 'mrow' }, sw('Sound', !S.mute, v => setMute(!v))),
    h('div', { class: 'mrow' }, sw('Fast animations (F)', S.fast, setFast)),
    h('p', { class: 'small' }, 'Click a spinning wheel, falling ball or dealing table to skip straight to the result.'),
    h('p', { class: 'small' }, 'Keys: Space = bet / deal / spin again · H S D P = hit, stand, double, split · Esc = lobby · M = sound · F = fast.'),
    S.practice ? h('div', { class: 'mrow' }, h('span', { class: 'pr-tag' }, 'PRACTICE'), h('span', { class: 'small' }, 'Pretend chips, nothing is sent to the server.'), live ? h('button', { class: 'btn sm', onclick: () => { closeModal(); boot(false); } }, 'Play for real') : null) : null,
    h('div', { class: 'mrow end' }, h('button', { class: 'btn gold', onclick: closeModal }, 'Done')));
}
