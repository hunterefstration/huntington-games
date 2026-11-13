// Practice mode: a built-in stand-in for the server's casino API (same ops, same replies, same live events), with
// pretend chips that never leave this page. It never talks to the server. Live tables are filled by a few bots.
function makeMock() {
  const fl = Math.floor, R = Math.random, ME = 'You';
  const LR = { cyc: 30000, bet: 22000, pay: 27000 }, CR = { cyc: 30000, bet: 7000, k: 0.00025, cap: 190 };
  const RACE = { cyc: 45000, bet: 30000, pay: 42000, odds: [2.5, 4, 6, 9, 14, 25], names: ['Thunderhoof', 'Biscuit', 'Midnight Run', 'Sir Trots', 'Lucky Clover', 'Longshot Larry'] };
  const POT = { cyc: 120000, bet: 115000 };
  const BOTS = ['Pip (bot)', 'Juno (bot)', 'Marlo (bot)', 'Rex (bot)', 'Tilly (bot)', 'Ozzy (bot)'];
  const salt = String(R());
  function hashN(tag, n = 1) {            // n numbers in [0,1) that depend only on the tag (a round's outcome)
    let x = 2166136261; for (const c of salt + '|' + tag) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
    const out = []; for (let i = 0; i < n; i++) { x = (x + 0x6D2B79F5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296); }
    return out;
  }
  const me = { chips: 10000, goons: 100, stats: { plays: 0, wag: 0, won: 0, big: 0 }, turn: null, daily: true };
  const feed = [], listeners = [];
  const emit = m => { m.now = Date.now(); for (const f of listeners.slice()) try { f(m); } catch (e) { console.error(e); } };

  // ----- pay tables (the same construction as the server) -----
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  function rouletteWin(bets, n) {
    let win = 0;
    for (const { k, a } of bets) {
      let m = 0;
      if (/^n\d+$/.test(k)) m = +k.slice(1) === n ? 36 : 0; else if (n === 0) m = 0;
      else if (k === 'red') m = RED.has(n) ? 2 : 0; else if (k === 'black') m = RED.has(n) ? 0 : 2;
      else if (k === 'odd') m = n % 2 ? 2 : 0; else if (k === 'even') m = n % 2 ? 0 : 2;
      else if (k === 'low') m = n <= 18 ? 2 : 0; else if (k === 'high') m = n >= 19 ? 2 : 0;
      else if (/^d[123]$/.test(k)) m = Math.ceil(n / 12) === +k[1] ? 3 : 0;
      else if (/^c[123]$/.test(k)) m = ((n - 1) % 3) + 1 === +k[1] ? 3 : 0;
      win += a * m;
    }
    return win;
  }
  const rouletteBets = a => { const b = Array.isArray(a.bets) ? a.bets : []; if (!b.length || b.some(x => !x || !Number.isInteger(x.a) || x.a < 1 || !/^(n([0-9]|[12][0-9]|3[0-6])|red|black|odd|even|low|high|d[123]|c[123])$/.test(x.k))) return null; return b.map(x => ({ k: x.k, a: x.a })); };
  const STRIPS = ['CLCBLSCLBCLD7CLBSCLWCLBS', 'LCBLCSLCDLCB7LCSBLCWLCBD', 'CBLCSLDCLBCL7SLCBLCWBLCS'].map(s => s.split(''));
  const LINES = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  function slotLine(a, b, c, pay) { const s = [a, b, c].filter(x => x !== 'W'); if (!s.length) return pay.W; if (s.every(x => x === s[0])) return pay[s[0]]; if (a === 'C' && (b === 'C' || b === 'W')) return pay.C2; return 0; }
  const SLOT_PAY = (() => {
    const base = { C2: 1.5, C: 6, L: 10, B: 18, S: 35, D: 90, 7: 250, W: 500 }; let sum = 0, n = 0; const [A, B, C] = STRIPS;
    for (const x of A) for (const y of B) for (const z of C) { sum += slotLine(x, y, z, base); n++; }
    const sc = 0.95 / (sum / n), pay = {}; for (const s in base) pay[s] = Math.round(base[s] * sc * 100) / 100; return pay;
  })();
  const PLINKO = {};
  for (const rows of [8, 12, 16]) for (const [risk, lo, hi, pw] of [['low', 0.5, 2.2 + rows * 0.45, 2], ['med', 0.3, rows * rows * 0.22, 3], ['high', 0.2, rows * rows * rows * 0.26, 5]]) {
    const p = []; let c = 1; for (let k = 0; k <= rows; k++) { p.push(c / 2 ** rows); c = c * (rows - k) / (k + 1); }
    const raw = p.map((_, k) => lo + (hi - lo) * Math.pow(Math.abs(k - rows / 2) / (rows / 2), pw)), ev = raw.reduce((t, m, k) => t + m * p[k], 0), sc = 0.97 / ev;
    PLINKO[rows + risk] = raw.map(m => { const x = m * sc; return x >= 10 ? Math.round(x) : Math.round(x * 100) / 100; });
  }
  const WHEEL = [].concat(Array(31).fill(0), Array(14).fill(1.2), Array(6).fill(1.5), Array(5).fill(2), Array(2).fill(3), [5, 10]);
  const KENO = {};
  { const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
    for (let n = 1; n <= 10; n++) {
      const p = []; for (let h = 0; h <= n; h++) p.push(C(10, h) * C(30, n - h) / C(40, n));
      const from = Math.max(1, Math.ceil(n * 0.4)), raw = p.map((_, h) => { if (h < from) return 0; let t = 0; for (let j = h; j <= n; j++) t += p[j]; return Math.pow(1 / t, 0.8); });
      const ev = raw.reduce((t, m, h) => t + m * p[h], 0), sc = 0.94 / ev; KENO[n] = raw.map(m => { const x = m * sc; return x >= 10 ? Math.round(x) : Math.round(x * 100) / 100; });
    } }
  const SCRATCH = { cost: [10, 50, 200], prizes: [[1000, 0.00004], [250, 0.0006], [50, 0.003], [10, 0.012], [5, 0.03], [2, 0.07], [1, 0.18]], sym: ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣', '👑', '🍀'] };
  const VP = [['Royal Flush', 250], ['Straight Flush', 50], ['Four of a Kind', 25], ['Full House', 8], ['Flush', 5], ['Straight', 4], ['Three of a Kind', 3], ['Two Pair', 2], ['Jacks or Better', 1]];
  const EDGE = { coin: 2, dice: 1, roulette: 2.7, slots: 5, plinko: 3, wheel: 5.5, keno: 6, baccarat: 1.2, craps: 1.4, sicbo: 2.8, scratch: 7, crashx: 3, bj: 1, vp: 3, mines: 3, hilo: 3, lr: 2.7, crash: 3, race: 3.8, pot: 3, duel: 3 };
  const NAMES = { coin: 'Coin Flip', dice: 'Dice', roulette: 'Roulette', slots: 'Slots', plinko: 'Plinko', wheel: 'Lucky Wheel', keno: 'Keno', baccarat: 'Baccarat', craps: 'Craps', sicbo: 'Sic Bo', scratch: 'Scratch Cards', crashx: 'Rocket', bj: 'Blackjack', vp: 'Video Poker', mines: 'Mines', hilo: 'Hi-Lo', lr: 'Live Roulette', crash: 'Live Rocket', race: 'Horse Racing', pot: 'The Pot', duel: 'Duels' };
  const card = () => ({ r: 1 + fl(R() * 13), s: fl(R() * 4) });
  const bacVal = c => (c.r >= 10 ? 0 : c.r);

  // ----- one-shot games -----
  const ONE = {
    coin(bet, a) { if (a.pick !== 'h' && a.pick !== 't') return { err: 'Pick heads or tails.' }; const side = R() < 0.5 ? 'h' : 't'; return { side, win: side === a.pick ? fl(bet * 1.96) : 0 }; },
    dice(bet, a) { const t = Number(a.target), over = !!a.over; if (!(t >= 2 && t <= 98) || fl(t) !== t) return { err: 'Pick a number from 2 to 98.' }; const roll = fl(R() * 10000) / 100, ch = over ? 100 - t : t, hit = over ? roll >= t : roll < t; return { roll, mult: Math.round(9900 / ch) / 100, win: hit ? fl(bet * 99 / ch) : 0 }; },
    roulette(bet, a) { const b = rouletteBets(a); if (!b) return { err: 'Place a bet on the table first.' }; const n = fl(R() * 37); return { n, win: rouletteWin(b, n) }; },
    slots(bet) { const stops = STRIPS.map(s => fl(R() * s.length)), grid = [0, 1, 2].map(row => STRIPS.map((s, i) => s[(stops[i] + row) % s.length])); let mult = 0; const lines = []; LINES.forEach((ln, i) => { const m = slotLine(grid[ln[0]][0], grid[ln[1]][1], grid[ln[2]][2], SLOT_PAY); if (m) { mult += m; lines.push({ line: i, m }); } }); return { grid, lines, win: fl(bet / 5 * mult) }; },
    plinko(bet, a) { const rows = [8, 12, 16].includes(a.rows) ? a.rows : 12, risk = ['low', 'med', 'high'].includes(a.risk) ? a.risk : 'med', path = []; let k = 0; for (let i = 0; i < rows; i++) { const r = R() < 0.5 ? 0 : 1; path.push(r); k += r; } const m = PLINKO[rows + risk][k]; return { rows, risk, path, slot: k, mult: m, win: fl(bet * m) }; },
    wheel(bet) { const i = fl(R() * 60); return { slice: i, mult: WHEEL[i], win: fl(bet * WHEEL[i]) }; },
    keno(bet, a) { const p = [...new Set(a.picks || [])].filter(x => Number.isInteger(x) && x >= 1 && x <= 40); if (p.length < 1 || p.length > 10 || p.length !== (a.picks || []).length) return { err: 'Pick 1 to 10 different numbers from 1 to 40.' }; const pool = Array.from({ length: 40 }, (_, i) => i + 1), drawn = []; for (let i = 0; i < 10; i++) drawn.push(pool.splice(fl(R() * pool.length), 1)[0]); const hits = p.filter(x => drawn.includes(x)).length, m = KENO[p.length][hits]; return { drawn, hits, mult: m, win: fl(bet * m) }; },
    baccarat(bet, a) {
      const b = a.bets || {}, st = { p: fl(b.p || 0), b: fl(b.b || 0), t: fl(b.t || 0) }; if (st.p + st.b + st.t !== bet) return { err: 'Put your chips on Player, Banker or Tie.' };
      const P = [card(), card()], B = [card(), card()], tot = h => h.reduce((s, c) => s + bacVal(c), 0) % 10;
      if (tot(P) < 8 && tot(B) < 8) { let p3 = null; if (tot(P) <= 5) { p3 = card(); P.push(p3); } const bt = tot(B.slice(0, 2)), v = p3 ? bacVal(p3) : null; const draw = p3 == null ? bt <= 5 : bt <= 2 || (bt === 3 && v !== 8) || (bt === 4 && v >= 2 && v <= 7) || (bt === 5 && v >= 4 && v <= 7) || (bt === 6 && (v === 6 || v === 7)); if (draw) B.push(card()); }
      const pt = tot(P), bt = tot(B), res = pt > bt ? 'p' : bt > pt ? 'b' : 't'; return { P, B, pt, bt, res, win: res === 't' ? st.t * 9 + st.p + st.b : res === 'p' ? st.p * 2 : fl(st.b * 1.95) };
    },
    craps(bet, a) {
      if (a.side !== 'pass' && a.side !== 'dont') return { err: 'Bet Pass or Don\'t Pass.' };
      const roll = () => [1 + fl(R() * 6), 1 + fl(R() * 6)], rolls = [roll()], sum = d => d[0] + d[1], first = sum(rolls[0]); let pass;
      if (first === 7 || first === 11) pass = true; else if (first === 2 || first === 3 || first === 12) pass = false;
      else for (let i = 0; i < 200; i++) { const d = roll(); rolls.push(d); if (sum(d) === first) { pass = true; break; } if (sum(d) === 7) { pass = false; break; } }
      const push = a.side === 'dont' && rolls.length === 1 && first === 12; return { rolls, point: rolls.length > 1 ? first : 0, pass, win: push ? bet : (a.side === 'pass') === !!pass ? bet * 2 : 0 };
    },
    sicbo(bet, a) {
      const bets = a.bets || []; if (!bets.length || bets.some(b => !/^(big|small|odd|even|triple|t([4-9]|1[0-7])|s[1-6])$/.test(b.k))) return { err: 'That is not a Sic Bo bet.' };
      const d = [1, 2, 3].map(() => 1 + fl(R() * 6)), t = d[0] + d[1] + d[2], trip = d[0] === d[1] && d[1] === d[2];
      const TOT = { 4: 61, 17: 61, 5: 31, 16: 31, 6: 18, 15: 18, 7: 13, 14: 13, 8: 9, 13: 9, 9: 7, 12: 7, 10: 7, 11: 7 }; let win = 0;
      for (const { k, a: amt } of bets) { let m = 0; if (k === 'big') m = !trip && t >= 11 ? 2 : 0; else if (k === 'small') m = !trip && t <= 10 ? 2 : 0; else if (k === 'odd') m = !trip && t % 2 ? 2 : 0; else if (k === 'even') m = !trip && t % 2 === 0 ? 2 : 0; else if (k === 'triple') m = trip ? 31 : 0; else if (k[0] === 't') m = t === +k.slice(1) ? TOT[t] : 0; else { const c = d.filter(x => x === +k[1]).length; m = c ? c + 1 : 0; } win += amt * m; }
      return { d, total: t, win };
    },
    scratch(bet) {
      let x = R(), prize = 0; for (const [m, p] of SCRATCH.prizes) { if (x < p) { prize = m; break; } x -= p; }
      const S2 = SCRATCH.sym, cells = [], winSym = prize ? S2[SCRATCH.prizes.findIndex(q => q[0] === prize) % S2.length] : null;
      if (winSym) for (let i = 0; i < 3; i++) cells.push(winSym);
      while (cells.length < 9) { const s = S2[fl(R() * S2.length)]; if (s !== winSym && cells.filter(c => c === s).length < 2) cells.push(s); }
      for (let i = 8; i > 0; i--) { const j = fl(R() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
      return { cells, mult: prize, win: bet * prize };
    },
    crashx(bet, a) { const t = Math.round(Number(a.target) * 100) / 100; if (!(t >= 1.01 && t <= 1000)) return { err: 'Pick a cash-out from 1.01x to 1000x.' }; const c = Math.max(1, fl(97 / (1 - R())) / 100); return { crash: c, target: t, win: c >= t ? fl(bet * t) : 0 }; }
  };

  // ----- games with turns -----
  const bjVal = hd => { let t = 0, ac = 0; for (const c of hd) { t += c.r === 1 ? 11 : Math.min(10, c.r); if (c.r === 1) ac++; } while (t > 21 && ac) { t -= 10; ac--; } return t; };
  const bjIsBJ = hd => hd.length === 2 && bjVal(hd) === 21;
  const bjCan = st => { const hd = st.hands[st.active], c = ['hit', 'stand']; if (hd.cards.length === 2) { c.push('double'); if (st.hands.length === 1 && Math.min(10, hd.cards[0].r) === Math.min(10, hd.cards[1].r)) c.push('split'); } return c; };
  const bjView = (st, over) => ({ hands: st.hands.map(x => ({ cards: x.cards, bet: x.bet, v: bjVal(x.cards), done: x.done })), active: st.active, dealer: over ? st.dealer : [st.dealer[0]], dv: over ? bjVal(st.dealer) : null, over: !!over, can: over ? [] : bjCan(st) });
  function bjFinish(st) {
    if (st.hands.some(x => bjVal(x.cards) <= 21 && !x.bj)) while (bjVal(st.dealer) < 17) st.dealer.push(card());
    const dv = bjVal(st.dealer), dbj = bjIsBJ(st.dealer); let win = 0;
    for (const x of st.hands) { const v = bjVal(x.cards); if (x.bj) win += dbj ? x.bet : fl(x.bet * 2.5); else if (v > 21 || dbj) win += 0; else if (dv > 21 || v > dv) win += x.bet * 2; else if (v === dv) win += x.bet; }
    return win;
  }
  function vpRank(hd) {
    const r = hd.map(c => c.r).sort((a, b) => a - b), flush = hd.every(c => c.s === hd[0].s), cnt = {}; r.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    const n = Object.values(cnt).sort((a, b) => b - a), uniq = Object.keys(cnt).length, straight = uniq === 5 && (r[4] - r[0] === 4 || (r[0] === 1 && r[1] === 10 && r[4] === 13));
    if (straight && flush) return r[0] === 1 && r[1] === 10 ? VP[0] : VP[1];
    if (n[0] === 4) return VP[2]; if (n[0] === 3 && n[1] === 2) return VP[3]; if (flush) return VP[4]; if (straight) return VP[5]; if (n[0] === 3) return VP[6]; if (n[0] === 2 && n[1] === 2) return VP[7];
    if (n[0] === 2) { const pr = +Object.keys(cnt).find(k => cnt[k] === 2); if (pr === 1 || pr >= 11) return VP[8]; }
    return ['Nothing', 0];
  }
  const C25 = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  const minesMult = (m, k) => (k ? Math.round(0.97 * C25(25, k) / C25(25 - m, k) * 100) / 100 : 1);
  const hlOdds = c => ({ hi: (13 - c) / 12, lo: (c - 1) / 12 }), hlPay = st => Math.round(0.97 * st.fair * 100) / 100;
  const hlView = (st, x) => Object.assign({ card: st.card, suit: st.suit, n: st.n, mult: st.n ? hlPay(st) : 1, hiX: st.card < 13 ? Math.round(97 * st.fair / hlOdds(st.card).hi) / 100 : 0, loX: st.card > 1 ? Math.round(97 * st.fair / hlOdds(st.card).lo) / 100 : 0 }, x || {});
  const TURN = {
    bj(st, act, a) {
      if (act === 'deal') { const P = [card(), card()], D = [card(), card()]; st = { g: 'bj', bet: a.bet, hands: [{ cards: P, bet: a.bet, done: false, bj: bjIsBJ(P) }], dealer: D, active: 0 }; if (st.hands[0].bj || bjIsBJ(D)) return { st: null, win: bjFinish(st), view: bjView(st, true) }; return { st, view: bjView(st) }; }
      if (!st) return { err: 'Deal a hand first.' };
      const hd = st.hands[st.active]; if (!bjCan(st).includes(act)) return { err: 'You cannot do that now.' };
      let take = 0;
      if (act === 'hit') { hd.cards.push(card()); if (bjVal(hd.cards) >= 21) hd.done = true; }
      else if (act === 'stand') hd.done = true;
      else if (act === 'double') { take = hd.bet; hd.bet *= 2; hd.cards.push(card()); hd.done = true; }
      else if (act === 'split') { take = hd.bet; const [c1, c2] = hd.cards; st.hands = [{ cards: [c1, card()], bet: hd.bet, done: false }, { cards: [c2, card()], bet: hd.bet, done: false }]; st.hands.forEach(x => { if (bjVal(x.cards) === 21) x.done = true; }); }
      while (st.active < st.hands.length && st.hands[st.active].done) st.active++;
      if (st.active >= st.hands.length) { st.active = st.hands.length - 1; return { st: null, win: bjFinish(st), take, view: bjView(st, true) }; }
      return { st, take, view: bjView(st) };
    },
    vp(st, act, a) {
      if (act === 'deal') { const deck = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s }); for (let i = 51; i > 0; i--) { const j = fl(R() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } st = { g: 'vp', bet: a.bet, deck, hand: deck.splice(0, 5) }; return { st, view: { hand: st.hand, rank: vpRank(st.hand)[0] } }; }
      if (!st || act !== 'draw') return { err: 'Deal first.' };
      const hold = new Set((a.hold || []).filter(i => Number.isInteger(i) && i >= 0 && i < 5)); st.hand = st.hand.map((c, i) => hold.has(i) ? c : st.deck.shift());
      const [name, m] = vpRank(st.hand); return { st: null, win: st.bet * m, view: { hand: st.hand, rank: name, mult: m, over: true } };
    },
    mines(st, act, a) {
      if (act === 'start') { const m = Number(a.mines); if (!Number.isInteger(m) || m < 1 || m > 24) return { err: 'Pick 1 to 24 mines.' }; const cells = Array.from({ length: 25 }, (_, i) => i), bombs = []; for (let i = 0; i < m; i++) bombs.push(cells.splice(fl(R() * cells.length), 1)[0]); st = { g: 'mines', bet: a.bet, m, bombs, picked: [] }; return { st, view: { mines: m, picked: [], mult: 1, next: minesMult(m, 1) } }; }
      if (!st) return { err: 'Start a round first.' };
      if (act === 'cash') { if (!st.picked.length) return { err: 'Open at least one tile first.' }; const mult = minesMult(st.m, st.picked.length); return { st: null, win: fl(st.bet * mult), view: { mines: st.m, picked: st.picked, bombs: st.bombs, mult, over: true, cashed: true } }; }
      const i = Number(a.i); if (!Number.isInteger(i) || i < 0 || i > 24 || st.picked.includes(i)) return { err: 'Pick a closed tile.' };
      if (st.bombs.includes(i)) return { st: null, win: 0, view: { mines: st.m, picked: st.picked, bombs: st.bombs, hit: i, mult: 0, over: true } };
      st.picked.push(i); const k = st.picked.length, mult = minesMult(st.m, k);
      if (k === 25 - st.m) return { st: null, win: fl(st.bet * mult), view: { mines: st.m, picked: st.picked, bombs: st.bombs, mult, over: true, cashed: true } };
      return { st, view: { mines: st.m, picked: st.picked, mult, next: minesMult(st.m, k + 1) } };
    },
    hilo(st, act, a) {
      if (act === 'start') { st = { g: 'hilo', bet: a.bet, card: 1 + fl(R() * 13), suit: fl(R() * 4), fair: 1, n: 0 }; return { st, view: hlView(st) }; }
      if (!st) return { err: 'Start a round first.' };
      if (act === 'cash') { if (!st.n) return { err: 'Guess at least once first.' }; return { st: null, win: fl(st.bet * hlPay(st)), view: hlView(st, { over: true, cashed: true }) }; }
      if (a.g !== 'hi' && a.g !== 'lo') return { err: 'Guess higher or lower.' };
      const p = hlOdds(st.card)[a.g]; if (!p) return { err: a.g === 'hi' ? 'Nothing is higher than a King.' : 'Nothing is lower than an Ace.' };
      const next = 1 + fl(R() * 13), was = st.card; st.card = next; st.suit = fl(R() * 4);
      if (next === was) return { st, view: hlView(st, { was, same: true }) };
      if ((a.g === 'hi') !== (next > was)) return { st: null, win: 0, view: hlView(st, { was, over: true, mult: 0 }) };
      st.fair /= p; st.n++;
      if (st.n >= 20 || hlPay(st) >= 5000) return { st: null, win: fl(st.bet * hlPay(st)), view: hlView(st, { was, over: true, cashed: true }) };
      return { st, view: hlView(st, { was }) };
    }
  };

  // ----- money -----
  const betOk = b => Number.isInteger(b) && b >= 5 && b <= 5000;
  const take = b => { if (me.chips < b) return false; me.chips -= b; me.stats.wag += b; return true; };
  function pay(win, g, bet, name = ME) {
    win = Math.max(0, fl(win)); if (name !== ME) { if (win >= bet * 10 || win - bet >= 800) addFeed({ n: name, g, bet, win, at: Date.now() }); return win; }
    me.stats.plays++; if (win > 0) { me.chips += win; me.stats.won += win; me.stats.big = Math.max(me.stats.big, win - bet); if (win >= bet * 10 || win - bet >= 800) addFeed({ n: name, g, bet, win, at: Date.now() }); }
    return win;
  }
  function addFeed(x) { feed.push(x); if (feed.length > 30) feed.shift(); emit({ ev: 'feed', item: x }); }

  // ----- live tables -----
  const roundOf = (cfg, t) => fl(t / cfg.cyc);
  const BOOK = { lr: new Map(), crash: new Map(), race: new Map(), pot: new Map() }, DONE = new Set(), SAID = new Set(), DUELS = new Map();
  const book = (g, r) => { let m = BOOK[g].get(r); if (!m) BOOK[g].set(r, m = new Map()); return m; };
  const lrNumber = r => fl(hashN('lr|' + r)[0] * 37);
  const crashPoint = r => Math.min(CR.cap, Math.max(1, fl(97 / (1 - hashN('crash|' + r)[0])) / 100));
  const crashAt = (r, t) => Math.round(Math.exp(CR.k * (t - (r * CR.cyc + CR.bet))) * 100) / 100;
  function raceOrder(r) { const hh = hashN('race|' + r, 6), left = RACE.odds.map((o, i) => ({ i, w: 1 / o })), order = []; for (let k = 0; k < 6; k++) { const tot = left.reduce((t, x) => t + x.w, 0); let x = hh[k] * tot, j = 0; while (j < left.length - 1 && x >= left[j].w) { x -= left[j].w; j++; } order.push(left.splice(j, 1)[0].i); } return order; }
  const once = k => { if (SAID.has(k)) return false; SAID.add(k); return true; };
  function settle(g, r) {
    const key = g + '|' + r; if (DONE.has(key)) return; DONE.add(key);
    const m = BOOK[g].get(r) || new Map(), results = []; let winner = null, total = 0;
    if (g === 'pot' && m.size) { for (const b of m.values()) total += b.bet; if (m.size > 1) { let x = hashN('pot|' + r)[0] * total; for (const [n, b] of m) { if (x < b.bet) { winner = n; break; } x -= b.bet; } if (!winner) winner = [...m.keys()].pop(); } }
    const n = lrNumber(r), c = crashPoint(r), order = g === 'race' ? raceOrder(r) : null;
    for (const [name, b] of m) {
      let win = 0, stake = 0;
      if (g === 'lr') { stake = b.bets.reduce((t, x) => t + x.a, 0); win = rouletteWin(b.bets, n); }
      else if (g === 'crash') { stake = b.bet; if (b.out) continue; if (b.auto && b.auto <= c) win = fl(b.bet * b.auto); }
      else if (g === 'race') { stake = b.bets.reduce((t, x) => t + x.a, 0); for (const x of b.bets) if (x.h === order[0]) win += fl(x.a * RACE.odds[x.h]); }
      else if (g === 'pot') { stake = b.bet; win = m.size === 1 ? b.bet : name === winner ? fl(total * 0.97) : 0; }
      results.push({ n: name, win: pay(win, g, stake, name), stake });
      if (name === ME) emit({ ev: 'bal', bal: bal() });
    }
    BOOK[g].delete(r);
    emit({ ev: 'paid', g, r, results: results.sort((a, b) => b.win - a.win).slice(0, 12), winner: g === 'pot' ? winner || undefined : undefined, total: g === 'pot' ? total : undefined });
  }
  function botBet(g, r, name, t) {
    if (g === 'lr') { const k = pick(['red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3', 'n' + fl(R() * 37)]), a = pick([5, 10, 25, 50, 100]); const b = book('lr', r).get(name); const all = (b ? b.bets : []).concat([{ k, a }]); book('lr', r).set(name, { bets: all }); emit({ ev: 'bet', g, r, n: name, a: all.reduce((s, x) => s + x.a, 0) }); }
    else if (g === 'race') { const hz = fl(R() * 6), a = pick([5, 10, 25, 50]); const b = book('race', r).get(name); const all = (b ? b.bets : []).concat([{ h: hz, a }]); book('race', r).set(name, { bets: all }); emit({ ev: 'bet', g, r, n: name, a: all.reduce((s, x) => s + x.a, 0) }); }
    else if (g === 'pot') { const a = pick([10, 25, 50, 100, 200]); const b = book('pot', r).get(name); book('pot', r).set(name, { bet: (b ? b.bet : 0) + a }); emit({ ev: 'bet', g, r, n: name, a: (b ? b.bet : 0) + a, total: [...book('pot', r).values()].reduce((s, x) => s + x.bet, 0) }); }
    else if (g === 'crash') { if (book('crash', r).has(name)) return; const a = pick([10, 25, 50, 100]); book('crash', r).set(name, { bet: a, bot: 1.1 + Math.pow(R(), 2) * 6 }); emit({ ev: 'bet', g, r, n: name, a }); }
  }
  const duelList = () => [...DUELS.values()].map(d => ({ id: d.id, n: d.n, bet: d.bet, at: d.at }));
  function duelResolve(d, takerName) {
    DUELS.delete(d.id); const takerWins = R() < 0.5, prize = fl(d.bet * 2 * 0.97), winner = takerWins ? takerName : d.n;
    if (d.n === ME || takerName === ME) { if (winner === ME) pay(prize, 'duel', d.bet); else pay(0, 'duel', d.bet); }
    emit({ ev: 'duel', id: d.id, a: d.n, b: takerName, bet: d.bet, winner, prize }); emit({ ev: 'duels', list: duelList() });
    return { takerWins, prize };
  }
  function tick() {
    const t = Date.now();
    { const r = roundOf(LR, t), x = t % LR.cyc;
      if (x < LR.bet - 1500 && R() < 0.012) botBet('lr', r, pick(BOTS), t);
      if (x >= LR.bet && once('lr|' + r)) emit({ ev: 'lr', r, n: lrNumber(r) });
      if (x >= LR.pay) settle('lr', r); settle('lr', r - 1); }
    { const r = roundOf(CR, t), x = t % CR.cyc, c = crashPoint(r), boomAt = CR.bet + Math.log(c) / CR.k;
      if (x < CR.bet - 1000 && R() < 0.02) botBet('crash', r, pick(BOTS), t);
      if (x >= CR.bet && once('cg|' + r)) emit({ ev: 'crashGo', r });
      if (x >= CR.bet && x < boomAt) { const m = crashAt(r, t); for (const [n, b] of book('crash', r)) if (b.bot && !b.out && m >= b.bot) { b.out = m; emit({ ev: 'out', r, n, mult: m, win: pay(b.bet * m, 'crash', b.bet, n) }); } }
      if (x >= boomAt) { if (once('cb|' + r)) emit({ ev: 'crash', r, c }); settle('crash', r); } }
    { const r = roundOf(RACE, t), x = t % RACE.cyc;
      if (x < RACE.bet - 1500 && R() < 0.01) botBet('race', r, pick(BOTS), t);
      if (x >= RACE.bet && once('rc|' + r)) emit({ ev: 'race', r, order: raceOrder(r) });
      if (x >= RACE.pay) settle('race', r); settle('race', r - 1); }
    { const r = roundOf(POT, t), x = t % POT.cyc;
      if (x < POT.bet - 2000 && R() < 0.006) botBet('pot', r, pick(BOTS), t);
      if (x >= POT.bet) settle('pot', r); settle('pot', r - 1); }
    if (R() < 0.004 && DUELS.size < 4) { const id = Math.random().toString(16).slice(2, 12), n = pick(BOTS); DUELS.set(id, { id, n, bet: pick([10, 25, 50, 100]), at: t }); emit({ ev: 'duels', list: duelList() }); }
    for (const d of DUELS.values()) { if (d.n === ME && t - d.at > d.wait) { duelResolve(d, pick(BOTS)); emit({ ev: 'bal', bal: bal() }); break; } if (d.n !== ME && t - d.at > 90000) { DUELS.delete(d.id); emit({ ev: 'duels', list: duelList() }); break; } }
  }
  function liveView(t) {
    const names = (g, r, f) => [...(BOOK[g].get(r) || new Map()).entries()].slice(0, 20).map(([n, b]) => f(n, b));
    const lr = roundOf(LR, t), cr = roundOf(CR, t), rc = roundOf(RACE, t), pt = roundOf(POT, t), sum = b => b.bets.reduce((s, x) => s + x.a, 0);
    return {
      lr: { r: lr, cyc: LR.cyc, bet: LR.bet, pay: LR.pay, n: t % LR.cyc >= LR.bet ? lrNumber(lr) : null, last: [1, 2, 3, 4, 5, 6, 7, 8].map(i => lrNumber(lr - i)), players: names('lr', lr, (n, b) => ({ n, a: sum(b) })) },
      crash: { r: cr, cyc: CR.cyc, bet: CR.bet, k: CR.k, last: [1, 2, 3, 4, 5, 6, 7, 8].map(i => crashPoint(cr - i)), players: names('crash', cr, (n, b) => ({ n, a: b.bet, out: b.out || 0 })) },
      race: { r: rc, cyc: RACE.cyc, bet: RACE.bet, pay: RACE.pay, odds: RACE.odds, names: RACE.names, order: t % RACE.cyc >= RACE.bet ? raceOrder(rc) : null, players: names('race', rc, (n, b) => ({ n, a: sum(b) })) },
      pot: { r: pt, cyc: POT.cyc, bet: POT.bet, total: [...(BOOK.pot.get(pt) || new Map()).values()].reduce((s, b) => s + b.bet, 0), players: names('pot', pt, (n, b) => ({ n, a: b.bet })) },
      duels: duelList()
    };
  }

  // ----- the API -----
  const bal = () => ({ chips: me.chips, goons: me.goons });
  let timer = null;
  async function casino(op, a) {
    a = a || {}; await sleep(60 + R() * 90);
    const t = Date.now(), ok = x => Object.assign({ ok: true, op, now: Date.now(), bal: bal() }, x || {}), no = m => { const e = new Error(m); e.casino = true; throw e; };
    if (op === 'enter') { if (!timer) timer = setInterval(tick, 250); return ok({ limits: { min: 5, max: 5000, rate: 100 }, stats: Object.assign({}, me.stats), edge: EDGE, names: NAMES, feed: feed.slice(-15), live: liveView(t), tables: { slots: SLOT_PAY, plinko: PLINKO, wheel: WHEEL, keno: KENO, scratch: SCRATCH.cost, vp: VP }, turn: me.turn ? { g: me.turn.g, bet: me.turn.bet } : null, daily: me.daily }); }
    if (op === 'leave') { clearInterval(timer); timer = null; return ok(); }
    if (op === 'live') return ok({ live: liveView(t) });
    if (op === 'buy' || op === 'cash') {
      const n = Number(a.goons); if (!Number.isInteger(n) || n < 1 || n > 10000) no('How many goons?');
      if (op === 'buy') { if (me.goons < n) no(`You have ${me.goons} goon${me.goons === 1 ? '' : 's'}.`); me.goons -= n; me.chips += n * 100; }
      else { if (me.chips < n * 100) no(`That needs ${n * 100} chips.`); me.chips -= n * 100; me.goons += n; }
      return ok();
    }
    if (op === 'daily') { if (!me.daily) no('You already had today\'s free spin. Come back tomorrow.'); me.daily = false; const prizes = [20, 20, 30, 30, 40, 50, 50, 75, 100, 150, 250, 500], i = fl(R() * 12); me.chips += prizes[i]; return ok({ slice: i, prizes, win: prizes[i] }); }
    if (ONE[op]) {
      let bet = op === 'roulette' ? (rouletteBets(a) || []).reduce((s, b) => s + b.a, 0) : op === 'scratch' ? SCRATCH.cost[a.tier] : Number(a.bet);
      if (op === 'baccarat' && a.bets) bet = fl(a.bets.p || 0) + fl(a.bets.b || 0) + fl(a.bets.t || 0);
      if (op === 'sicbo' && Array.isArray(a.bets)) bet = a.bets.reduce((s, b) => s + (b && Number.isInteger(b.a) ? b.a : 0), 0);
      if (!betOk(bet)) no('Bets are 5 to 5000 chips.'); if (me.chips < bet) no('Not enough chips. Buy some at the cage.');
      const r = ONE[op](bet, a); if (r.err) no(r.err); take(bet); r.win = pay(r.win, op, bet); r.bet = bet; return ok({ r });
    }
    if (TURN[op]) {
      const act = String(a.act || ''); let st = me.turn && me.turn.g === op ? me.turn : null; const opening = act === 'deal' || act === 'start';
      if (opening) { if (me.turn) no('Finish your ' + NAMES[me.turn.g] + ' first.'); if (!betOk(a.bet)) no('Bets are 5 to 5000 chips.'); if (me.chips < a.bet) no('Not enough chips. Buy some at the cage.'); }
      if (act === 'state') return ok({ r: st ? { resume: true, bet: st.bet, view: op === 'bj' ? bjView(st) : op === 'vp' ? { hand: st.hand, rank: vpRank(st.hand)[0] } : op === 'mines' ? { mines: st.m, picked: st.picked, mult: minesMult(st.m, st.picked.length), next: minesMult(st.m, st.picked.length + 1) } : hlView(st) } : null });
      if (op === 'bj' && st && (act === 'double' || act === 'split') && me.chips < st.hands[st.active].bet) no('Not enough chips for that.');
      const r = TURN[op](opening ? null : st, act, a); if (r.err) no(r.err);
      if (opening) take(a.bet); if (r.take) take(r.take);
      const total = opening ? a.bet : st ? (op === 'bj' ? st.hands.reduce((s, x) => s + x.bet, 0) : st.bet) : 0;
      if (r.st) { me.turn = r.st; return ok({ r: { view: r.view, bet: r.st.bet } }); }
      me.turn = null; const win = pay(r.win, op, Math.max(total, 1)); return ok({ r: { view: r.view, win, bet: total, over: true } });
    }
    if (op === 'lr' || op === 'race') {
      const cfg = op === 'lr' ? LR : RACE, r = roundOf(cfg, t); if (t % cfg.cyc >= cfg.bet - 300) no('Bets are closed for this round.');
      const bets = op === 'lr' ? rouletteBets(a) : (Array.isArray(a.bets) && a.bets.length && a.bets.every(b => Number.isInteger(b.h) && b.h >= 0 && b.h < 6 && Number.isInteger(b.a) && b.a >= 1) ? a.bets.map(b => ({ h: b.h, a: b.a })) : null);
      if (!bets) no('Place a bet first.');
      const stake = bets.reduce((s, b) => s + b.a, 0), mine = book(op, r).get(ME), had = mine ? mine.bets.reduce((s, b) => s + b.a, 0) : 0;
      if (!betOk(stake) || had + stake > 5000) no('Bets are 5 to 5000 chips a round.'); if (!take(stake)) no('Not enough chips. Buy some at the cage.');
      const all = (mine ? mine.bets : []).concat(bets); book(op, r).set(ME, { bets: all }); emit({ ev: 'bet', g: op, r, n: ME, a: had + stake });
      return ok({ r: { round: r, bets: all } });
    }
    if (op === 'crash') {
      const r = roundOf(CR, t), x = t % CR.cyc;
      if (a.act === 'cash') {
        const b = book('crash', r).get(ME); if (!b || b.out) no('You have no bet in the air.');
        const c = crashPoint(r), mult = crashAt(r, t); if (x < CR.bet) no('The rocket has not launched yet.'); if (mult >= c) no('Too late: it blew up.');
        b.out = mult; const win = pay(b.bet * mult, 'crash', b.bet); emit({ ev: 'out', r, n: ME, mult, win }); return ok({ r: { mult, win } });
      }
      if (x >= CR.bet - 200) no('It has launched. Bet on the next one.'); if (book('crash', r).has(ME)) no('You are already on this rocket.');
      const auto = a.auto ? Math.round(Number(a.auto) * 100) / 100 : 0; if (auto && !(auto >= 1.01 && auto <= CR.cap)) no('Auto cash-out is 1.01x to 190x.');
      if (!betOk(a.bet)) no('Bets are 5 to 5000 chips.'); if (!take(a.bet)) no('Not enough chips. Buy some at the cage.');
      book('crash', r).set(ME, { bet: a.bet, auto }); emit({ ev: 'bet', g: 'crash', r, n: ME, a: a.bet }); return ok({ r: { round: r, bet: a.bet, auto } });
    }
    if (op === 'pot') {
      const r = roundOf(POT, t); if (t % POT.cyc >= POT.bet - 300) no('The pot is being drawn. Join the next one.'); if (!betOk(a.bet)) no('Bets are 5 to 5000 chips.');
      const mine = book('pot', r).get(ME), had = mine ? mine.bet : 0; if (had + a.bet > 5000) no('At most 5000 chips in one pot.'); if (!take(a.bet)) no('Not enough chips. Buy some at the cage.');
      book('pot', r).set(ME, { bet: had + a.bet }); emit({ ev: 'bet', g: 'pot', r, n: ME, a: had + a.bet, total: [...book('pot', r).values()].reduce((s, b) => s + b.bet, 0) }); return ok({ r: { round: r, bet: had + a.bet } });
    }
    if (op === 'duel') {
      if (a.act === 'open') {
        if ([...DUELS.values()].filter(d => d.n === ME).length >= 2) no('You already have two duels waiting.'); if (!betOk(a.bet) || a.bet > 1000) no('Duels are 5 to 1000 chips.'); if (!take(a.bet)) no('Not enough chips. Buy some at the cage.');
        const id = Math.random().toString(16).slice(2, 12); DUELS.set(id, { id, n: ME, bet: a.bet, at: t, wait: 6000 + R() * 12000 }); emit({ ev: 'duels', list: duelList() }); return ok({ r: { id } });
      }
      const d = DUELS.get(String(a.id || '')); if (!d) no('That duel is gone.');
      if (a.act === 'cancel') { if (d.n !== ME) no('That is not your duel.'); DUELS.delete(d.id); me.chips += d.bet; emit({ ev: 'duels', list: duelList() }); return ok(); }
      if (d.n === ME) no('You cannot duel yourself.'); if (!take(d.bet)) no('Not enough chips. Buy some at the cage.');
      const res = duelResolve(d, ME); return ok({ r: { won: res.takerWins, prize: res.prize, vs: d.n } });
    }
    no('The casino has no game called that.');
  }
  return { mock: true, eco: { casino }, on(type, fn) { if (type === 'casino') listeners.push(fn); }, off(type, fn) { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }, me: () => ({ name: ME }), online: () => true, _me: me };
}
