// The shared framework: toasts, a modal, chips, cards, the game registry, the game frame and the bet bar.

// ---------- toasts ----------
function toast(msg, kind, ms) {
  const t = h('div', { class: 'toast ' + (kind || '') }, msg); $('#toasts').append(t);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms || (kind === 'err' ? 3200 : 2200));
}
// ---------- modal ----------
function modal(...content) { const b = $('#mbox'); b.innerHTML = ''; b.append(...content); $('#modal').classList.remove('hidden'); return b; }
function closeModal() { $('#modal').classList.add('hidden'); $('#mbox').innerHTML = ''; }
const modalOpen = () => !$('#modal').classList.contains('hidden');

// ---------- chips ----------
const CHIP_VALUES = [5, 10, 25, 100, 500];
const chipClass = v => (v >= 1000 ? 'v1k' : v >= 500 ? 'v500' : v >= 100 ? 'v100' : v >= 25 ? 'v25' : v >= 10 ? 'v10' : 'v5');
const chipLabel = v => (v >= 1000 ? (v % 1000 ? (v / 1000).toFixed(1) : v / 1000) + 'K' : String(v));
function chipEl(v, size) { return h('span', { class: 'chip ' + chipClass(v) + (size ? ' ' + size : '') }, chipLabel(v)); }

// ---------- playing cards ----------
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const FACE = { 11: '🤴', 12: '👸', 13: '🫅' };
function cardEl(c, down, cls) {
  const red = c && (c.s === 1 || c.s === 2), r = c ? RANKS[c.r] : '', s = c ? SUITS[c.s] : '';
  return h('div', { class: 'pcard' + (red ? ' red' : '') + (down ? ' down' : '') + (cls ? ' ' + cls : '') },
    h('div', { class: 'f' }, h('div', { class: 'tl', html: r + '<small>' + s + '</small>' }), h('div', { class: 'md' }, c && FACE[c.r] ? FACE[c.r] : s), h('div', { class: 'br', html: r + '<small>' + s + '</small>' })),
    h('div', { class: 'b' }));
}
function setCard(el, c) { const n = cardEl(c, el.classList.contains('down')); el.className = n.className + (el.classList.contains('deal') ? ' deal' : ''); el.innerHTML = n.innerHTML; }
async function dealCard(row, c, down, cls) { const e = cardEl(c, down, 'deal' + (cls ? ' ' + cls : '')); row.append(e); sfx.deal(); await wait(260); return e; }
async function flipUp(el, c) { if (c) setCard(el, c); sfx.flip(); el.classList.remove('down'); await wait(300); }

// ---------- the game registry ----------
const GAMES = [], GROUPS = { table: 'Tables', machine: 'Machines', live: 'Live with everyone' };
function defGame(def) { GAMES.push(def); return def; }
const gameById = id => GAMES.find(g => g.id === id);

// ---------- the frame every game screen sits in ----------
function gameFrame(def, side) {
  const info = h('button', { class: 'btn sm g-info', onclick: () => root.classList.toggle('show-side') }, 'Pay table');
  const edge = S.edge[def.edgeKey || def.id];
  const top = h('div', { class: 'gtop' }, h('span', { class: 'g-ico' }, def.icon), h('h2', null, def.title),
    edge != null ? h('span', { class: 'g-edge', title: 'The house keeps this much of every chip bet, on average' }, 'House edge ' + edge + '% · returns ' + (100 - edge).toFixed(1) + '%') : null,
    h('span', { class: 'g-hint' }, def.hint || ''), info);
  const main = h('div', { class: 'gmain' }), sideEl = h('div', { class: 'gside' }), bar = h('div', { class: 'gbar' });
  if (side) sideEl.append(...[].concat(side)); else { sideEl.classList.add('hidden'); info.classList.add('hidden'); }
  const root = h('div', { class: 'game g-' + def.id }, top, h('div', { class: 'gbody' }, main, sideEl), bar);
  sideEl.addEventListener('click', e => { if (e.target === sideEl) root.classList.remove('show-side'); });
  return { root, top, main, side: sideEl, bar };
}
function payTable(title, rows, note) {        // rows: [label, value, key?]
  return h('div', { class: 'ptab' }, h('h3', null, title), h('table', null, ...rows.map(r => h('tr', { 'data-k': r[2] != null ? r[2] : '' }, h('td', { html: r[0] }), h('td', { html: r[1] })))), note ? h('p', { class: 'pnote', html: note }) : null);
}

// ---------- the bet bar ----------
// mode 'stake': the chips add up to one stake for the next play. mode 'chips': pick a chip, then click the table.
function betBar(def, opt) {
  const id = def.id, mode = opt.mode || 'stake', B = { mode };
  const lim = () => S.limits;
  let bet = clamp(store.get('bet:' + id, opt.def || 10), lim().min, lim().max), chip = store.get('chip:' + id, 10);
  const val = h('b', { class: 'bb-v num' }), lbl = h('span', { class: 'bb-l' }, mode === 'stake' ? 'Bet' : 'On the table');
  const chips = h('div', { class: 'bb-chips' });
  const vals = CHIP_VALUES.concat(['max']);
  const chipBtns = vals.map(v => {
    const b = h('button', { class: 'bb-chip lockable', title: v === 'max' ? 'The most you can bet' : (mode === 'stake' ? 'Add ' : 'Use ') + v, onclick: () => { sfx.chip(); if (mode === 'stake') { if (v === 'max') B.bet = Math.min(lim().max, Math.max(lim().min, shownChips()), opt.max || 1e9); else B.bet = (B.bet === lim().min && fresh ? 0 : B.bet) + v; fresh = false; } else { chip = v; store.set('chip:' + id, v); paint(); } } },
      v === 'max' ? h('span', { class: 'chip vmax' }, 'MAX') : chipEl(v));
    b.dataset.v = v; chips.append(b); return b;
  });
  let fresh = false;
  const mk = (t, title, fn, cls) => h('button', { class: 'btn sm lockable ' + (cls || ''), title, onclick: fn }, t);
  const tools = h('div', { class: 'bb-tools' });
  if (mode === 'stake') tools.append(mk('Clear', 'Back to the smallest bet', () => { B.bet = lim().min; fresh = true; }), mk('½', 'Halve the bet', () => { B.bet = Math.floor(B.bet / 2); }), mk('×2', 'Double the bet', () => { B.bet = B.bet * 2; }));
  else tools.append(mk('Undo', 'Take back the last chip', () => opt.undo && opt.undo()), mk('Clear', 'Take your chips off the table (Backspace)', () => opt.clear && opt.clear()), mk('Repeat', 'Put down your last bets again (R)', () => opt.repeat && opt.repeat()));
  const prim = h('button', { class: 'btn big gold bb-go lockable', onclick: () => opt.go && opt.go() }, opt.label || 'Bet');
  const extra = h('div', { class: 'bb-extra' }, ...(opt.extra || []));
  B.el = h('div', { class: 'betbar' }, h('div', { class: 'bb-amt' }, lbl, val), chips, tools, extra, prim);
  function paint() {
    if (mode === 'stake') { val.textContent = fmt(bet); chipBtns.forEach(b => b.classList.remove('sel')); }
    else { val.textContent = fmt(B.total || 0); chipBtns.forEach(b => b.classList.toggle('sel', String(b.dataset.v) === String(chip))); }
  }
  Object.defineProperty(B, 'bet', { get: () => bet, set: v => { bet = clamp(Math.floor(v) || 0, lim().min, Math.min(lim().max, opt.max || 1e9)); store.set('bet:' + id, bet); paint(); opt.onChange && opt.onChange(bet); } });
  Object.defineProperty(B, 'chip', { get: () => (chip === 'max' ? Math.max(lim().min, Math.min(lim().max - (B.total || 0), shownChips() - (B.total || 0))) : chip) });
  B.total = 0; B.setTotal = n => { B.total = n; paint(); };
  B.label = (t, en = true) => { prim.textContent = t; prim.disabled = !en; };
  B.prim = prim; B.extra = extra; B.paint = paint;
  paint();
  return B;
}

// ---------- the end of every play: show the profit, play a sound, tell the tests ----------
function finish(g, bet, win, note, el) {
  releaseBal(); trackPlay(bet, win);
  const profit = win - bet, big = win >= bet * 5 && win > 0;
  if (el) showBanner(el, win > 0 ? (profit > 0 ? '+' + fmt(profit) : profit === 0 ? 'Push' : 'Back ' + fmt(win)) : 'No win', win > 0 ? (profit >= 0 ? 'win' : 'part') : 'lose', note);
  if (win > bet) sfx.win(big); else if (win === 0) sfx.lose(); else sfx.coin();
  if (win > bet) toast((note ? note + ': ' : '') + 'you won ' + fmt(win) + ' chips (+' + fmt(profit) + ')', 'win');
  announce({ g, bet, win, chips: S.bal.chips });
}
function showBanner(el, big, kind, small) {
  const old = el.querySelector('.banner'); if (old) old.remove();
  const b = h('div', { class: 'banner ' + kind }, h('b', null, big), small ? h('small', null, small) : null);
  el.append(b); setTimeout(() => b.classList.add('out'), 1900); setTimeout(() => b.remove(), 2400);
}

// ---------- live table clock ----------
function phase(L) { const t = now(), r = Math.floor(t / L.cyc), x = t - r * L.cyc; return { r, x, left: L.bet - x, toNext: L.cyc - x }; }
const secs = ms => Math.max(0, Math.ceil(ms / 1000));
