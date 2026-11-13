// Machines: Slots, Plinko, Lucky Wheel, Keno, Scratch Cards, Mines, Hi-Lo, Dice, Coin Flip, Rocket.

// a canvas that keeps its backing store matched to its box
function fitCanvas(cv, draw) {
  const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); if (!r.width || !r.height) return; const w = Math.round(r.width * d), hh = Math.round(r.height * d); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } draw && draw(); };
  const ro = new ResizeObserver(fit); ro.observe(cv); requestAnimationFrame(fit);
  return () => ro.disconnect();
}

// ---------- Slots ----------
const SYM = { C: '🍒', L: '🍋', B: '🔔', S: '⭐', D: '💎', 7: '7', W: '🃏' };
const SLOT_LN = [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
defGame({ id: 'slots', title: 'Slots', group: 'machine', icon: '🎰', c1: '#c2185b', c2: '#4a0a24', blurb: '3 reels, 5 lines, wild joker',
  mount() {
    const def = this, P = (S.tables && S.tables.slots) || {};
    const rows = ['W', '7', 'D', 'S', 'B', 'L', 'C'].map(k => [`<span class="sym s${k}">${SYM[k]}</span>`.repeat(3), fmtX(P[k] || 0) + ' line', k]);
    rows.push(['<span class="sym sC">🍒</span><span class="sym sC">🍒</span> from the left', fmtX(P.C2 || 0) + ' line', 'C2']);
    const F = gameFrame(def, payTable('Pays per line', rows, 'Your bet is split over 5 lines (3 rows, 2 diagonals). 🃏 is wild.'));
    const reels = [0, 1, 2].map(() => h('div', { class: 'reel' }, h('div', { class: 'strip' })));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 300 300'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('slines');
    const win = h('div', { class: 'slwin' }, 'Good luck!');
    F.main.append(h('div', { class: 'cabinet' }, h('div', { class: 'cab-top' }, '★ LUCKY GOON SLOTS ★'), h('div', { class: 'reels' }, ...reels, svg), win));
    const symEl = k => h('div', { class: 'cell' }, h('span', { class: 'sym s' + k }, SYM[k]));
    const keys = Object.keys(SYM); let grid = [['C', 'L', 'B'], ['S', '7', 'D'], ['W', 'C', 'L']];
    const setReel = (i, col) => { const st = reels[i].firstChild; st.innerHTML = ''; col.forEach(k => st.append(symEl(k))); st.style.transform = 'translateY(0)'; };
    [0, 1, 2].forEach(i => setReel(i, grid.map(r => r[i])));
    const bar = betBar(def, { label: 'Spin', go: spin }); F.bar.append(bar.el);
    async function spin() {
      await act(async () => {
        const rep = await call('slots', { bet: bar.bet }, { hold: true }), r = rep.r; svg.innerHTML = ''; win.textContent = ''; $$('.cell', F.main).forEach(c => c.classList.remove('lit'));
        sfx.spin();
        await animate(() => Promise.all(reels.map(async (rl, i) => {
          const st = rl.firstChild, n = 18 + i * 7, old = grid.map(rw => rw[i]), fin = r.grid.map(rw => rw[i]);
          st.innerHTML = ''; fin.forEach(k => st.append(symEl(k))); for (let j = 0; j < n; j++) st.append(symEl(pick(keys))); old.forEach(k => st.append(symEl(k)));
          const cellH = rl.clientHeight / 3, total = (n + 3) * cellH;
          await tween(1200 + i * 450, e => { st.style.transform = `translateY(${-total * (1 - e)}px)`; }, p => 1 - Math.pow(1 - p, 4));
          st.style.transform = 'translateY(0)'; while (st.children.length > 3) st.lastChild.remove(); sfx.tick();
        })));
        grid = r.grid;
        for (const ln of r.lines) {
          const L = SLOT_LN[ln.line], pts = L.map((row, col) => (col * 100 + 50) + ',' + (row * 100 + 50)).join(' ');
          const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); pl.setAttribute('points', pts); pl.setAttribute('class', 'ln l' + ln.line); svg.append(pl);
          L.forEach((row, col) => reels[col].firstChild.children[row].classList.add('lit'));
        }
        win.textContent = r.lines.length ? r.lines.length + ' line' + (r.lines.length > 1 ? 's' : '') + ' · ' + fmt(r.win) + ' chips' : 'No line this time';
        finish('slots', r.bet, r.win, r.lines.length ? r.lines.map(l => fmtX(l.m)).join(' + ') + ' lines' : '', F.main);
      });
    }
    return { root: F.root, primary: spin };
  } });

// ---------- Plinko ----------
const pColor = m => (m >= 10 ? '#ff3b5c' : m >= 3 ? '#ff7a3b' : m >= 1.5 ? '#ffb43b' : m >= 1 ? '#e8d23b' : m >= 0.5 ? '#7fd36b' : '#3bb5a8');
defGame({ id: 'plinko', title: 'Plinko', group: 'machine', icon: '🔻', c1: '#7a2fbf', c2: '#2a0f45', blurb: 'Drop the ball, pick the risk',
  mount() {
    const def = this; let rows = store.get('plinko:rows', 12), risk = store.get('plinko:risk', 'med');
    const tab = () => ((S.tables && S.tables.plinko) || {})[rows + risk] || [];
    const side = h('div'); const F = gameFrame(def, side);
    const cv = h('canvas', { class: 'pcv' }); F.main.append(h('div', { class: 'pbox' }, cv));
    let ball = null, lit = -1;
    function geo() { const W = cv.width, H = cv.height, gap = Math.min(W / (rows + 3), (H - 50) / (rows + 1.5)), top = gap * 0.9; return { W, H, gap, top, x0: W / 2 }; }
    const pegXY = (i, j, G) => [G.x0 + (j - (i + 2) / 2) * G.gap, G.top + i * G.gap];
    function draw() {
      const c = cv.getContext('2d'), G = geo(); c.clearRect(0, 0, G.W, G.H);
      for (let i = 0; i < rows; i++) for (let j = 0; j <= i + 2; j++) { const [x, y] = pegXY(i, j, G); c.beginPath(); c.arc(x, y, Math.max(2, G.gap * 0.09), 0, 7); c.fillStyle = '#dfe3ff'; c.fill(); }
      const T = tab(), by = G.top + rows * G.gap - G.gap * 0.3;
      T.forEach((m, k) => { const x = G.x0 + (k - rows / 2) * G.gap, w = G.gap * 0.92, hh = G.gap * 0.8; c.fillStyle = pColor(m); c.globalAlpha = lit === k ? 1 : 0.85; c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, by + (lit === k ? 6 : 0), w, hh, 5) : c.rect(x - w / 2, by, w, hh); c.fill(); c.globalAlpha = 1; c.fillStyle = '#1a1020'; c.font = 'bold ' + Math.round(Math.min(G.gap * 0.3, 14 * (cv.width / cv.clientWidth || 1))) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m >= 100 ? Math.round(m) : m, x, by + hh / 2 + (lit === k ? 6 : 0)); });
      if (ball) { c.beginPath(); c.arc(ball.x, ball.y, G.gap * 0.22, 0, 7); c.fillStyle = '#ff4fa3'; c.shadowColor = '#ff4fa3'; c.shadowBlur = 14; c.fill(); c.shadowBlur = 0; }
    }
    const unfit = fitCanvas(cv, draw);
    const seg = (vals, cur, fn, lab) => { const w = h('div', { class: 'seg' }, h('span', null, lab)); vals.forEach(v => w.append(h('button', { class: 'btn sm lockable' + (v == cur ? ' sel' : ''), onclick: e => { $$('button', w).forEach(b => b.classList.remove('sel')); e.target.classList.add('sel'); fn(v); } }, String(v)))); return w; };
    const segR = seg([8, 12, 16], rows, v => { rows = v; store.set('plinko:rows', v); lit = -1; draw(); paintSide(); }, 'Rows');
    const segK = seg(['low', 'med', 'high'], risk, v => { risk = v; store.set('plinko:risk', v); lit = -1; draw(); paintSide(); }, 'Risk');
    function paintSide() { side.innerHTML = ''; side.append(payTable('Pays (' + rows + ' rows, ' + risk + ')', tab().map((m, k) => ['Slot ' + (k + 1), fmtX(m)]), 'Middle slots are the most likely; the edges pay the most.')); }
    paintSide();
    const bar = betBar(def, { label: 'Drop', go: drop, extra: [segR, segK] }); F.bar.append(bar.el);
    async function drop() {
      await act(async () => {
        const rep = await call('plinko', { bet: bar.bet, rows, risk }, { hold: true }), r = rep.r; lit = -1;
        await animate(async () => {
          let k = 0; const G0 = geo(); ball = { x: G0.x0, y: G0.top - G0.gap * 0.8 };
          for (let i = 0; i <= r.path.length; i++) {
            const G = geo(), fx = ball.x, fy = ball.y, tx = G.x0 + (k - i / 2) * G.gap, ty = G.top + i * G.gap - G.gap * 0.45;
            const tx2 = i === r.path.length ? G.x0 + (k - rows / 2) * G.gap : tx;
            await tween(i === r.path.length ? 260 : 170, (e, p) => { ball.x = fx + (tx2 - fx) * p; ball.y = fy + (ty - fy) * p - Math.sin(p * Math.PI) * G.gap * 0.35; draw(); }, ease.lin);
            if (i < r.path.length) { sfx.tick(); k += r.path[i]; }
          }
        });
        ball = null; lit = r.slot; draw();
        finish('plinko', r.bet, r.win, fmtX(r.mult), F.main);
      });
    }
    return { root: F.root, primary: drop, unmount: unfit };
  } });

// ---------- Lucky Wheel ----------
const WCOL = { 0: '#3a3f55', 1.2: '#2b6fe0', 1.5: '#1c9a55', 2: '#d9b21a', 3: '#e2731a', 5: '#8a3bd1', 10: '#e2434b' };
defGame({ id: 'wheel', title: 'Lucky Wheel', group: 'machine', icon: '🎡', c1: '#d9951a', c2: '#4a2c05', blurb: '60 slices, up to 10x',
  mount() {
    const def = this, WH = (S.tables && S.tables.wheel) || [], counts = {};
    WH.forEach(m => counts[m] = (counts[m] || 0) + 1);
    const F = gameFrame(def, payTable('The wheel', Object.keys(counts).sort((a, b) => b - a).map(m => [`<i class="sw" style="background:${WCOL[m] || '#555'}"></i>${fmtX(+m)}`, counts[m] + ' of ' + WH.length + ' slices']), 'Each slice is equally likely.'));
    // show the slices mixed around the rim (the server's index i is drawn at position pos[i])
    const N = WH.length || 60, order = []; { const by = {}; WH.forEach((m, i) => (by[m] = by[m] || []).push(i)); const ks = Object.keys(by).sort((a, b) => a - b); let left = N; const take = ks.map(k => by[k].slice()); let t = 0; while (left) { const m = take[t % take.length]; if (m.length) { order.push(m.shift()); left--; } t++; } }
    const pos = []; { const zeros = [], other = []; order.forEach(i => (WH[i] === 0 ? zeros : other).push(i)); const seq = []; let z = 0, o = 0; for (let p = 0; p < N; p++) { const wantZero = z < zeros.length && (o >= other.length || (p * zeros.length / N) >= z); seq.push(wantZero ? zeros[z++] : other[o++]); } seq.forEach((i, p) => pos[i] = p); }
    const cv = h('canvas', { class: 'wcv', width: 460, height: 460 }), out = h('div', { class: 'wout' }, '');
    F.main.append(h('div', { class: 'wbox' }, h('div', { class: 'wwrap' }, cv, h('div', { class: 'wptr' }, '▼')), out));
    let rot = 0, hit = -1;
    function draw() {
      const c = cv.getContext('2d'), W = cv.width, R = W / 2 - 8, st = 2 * Math.PI / N; c.clearRect(0, 0, W, W); c.save(); c.translate(W / 2, W / 2); c.rotate(rot);
      for (let i = 0; i < N; i++) { const p = pos[i], a0 = -Math.PI / 2 + (p - 0.5) * st; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a0 + st); c.closePath(); c.fillStyle = WCOL[WH[i]] || '#555'; c.fill(); c.strokeStyle = hit === i ? '#fff' : '#0006'; c.lineWidth = hit === i ? 4 : 1; c.stroke();
        c.save(); c.rotate(a0 + st / 2); c.fillStyle = '#fff'; c.font = 'bold 12px system-ui'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(WH[i] ? WH[i] + 'x' : '', R - 6, 0); c.restore(); }
      c.beginPath(); c.arc(0, 0, R * 0.22, 0, 7); c.fillStyle = '#15192e'; c.fill(); c.strokeStyle = '#f6c446'; c.lineWidth = 4; c.stroke(); c.restore();
      c.beginPath(); c.arc(W / 2, W / 2, R + 3, 0, 7); c.strokeStyle = '#f6c446'; c.lineWidth = 6; c.stroke();
    }
    draw();
    const bar = betBar(def, { label: 'Spin', go: spin }); F.bar.append(bar.el);
    async function spin() {
      await act(async () => {
        const rep = await call('wheel', { bet: bar.bet }, { hold: true }), r = rep.r; hit = -1; out.textContent = '';
        const st = 2 * Math.PI / N, r0 = rot; let r1 = -pos[r.slice] * st + (Math.random() - 0.5) * st * 0.7; while (r1 < r0 + 2 * Math.PI * 5) r1 += 2 * Math.PI;
        sfx.spin(); let lt = 0;
        await animate(() => tween(4600, e => { rot = r0 + (r1 - r0) * e; const k = Math.floor(rot / st); if (k !== lt) { lt = k; sfx.tick(); } draw(); }, p => 1 - Math.pow(1 - p, 4)));
        hit = r.slice; draw(); out.innerHTML = r.mult ? `<b style="color:${WCOL[r.mult]}">${fmtX(r.mult)}</b>` : 'Zero';
        finish('wheel', r.bet, r.win, fmtX(r.mult), F.main);
      });
    }
    return { root: F.root, primary: spin };
  } });

// ---------- Keno ----------
defGame({ id: 'keno', title: 'Keno', group: 'machine', icon: '🔢', c1: '#0f8a8a', c2: '#073636', blurb: 'Pick up to 10 of 40',
  mount() {
    const def = this, K = (S.tables && S.tables.keno) || {}; let picks = new Set(store.get('keno:picks', [3, 7, 11, 19, 23]));
    const side = h('div'), F = gameFrame(def, side), grid = h('div', { class: 'kgrid' }), balls = h('div', { class: 'kballs' }), info = h('div', { class: 'tmsg' });
    for (let n = 1; n <= 40; n++) grid.append(h('button', { class: 'kc', 'data-n': n, onclick: () => tog(n) }, n));
    F.main.append(h('div', { class: 'felt kfelt' }, info, grid, balls));
    function tog(n) { if (S.busy || animating) return; clearDraw(); if (picks.has(n)) picks.delete(n); else if (picks.size < 10) picks.add(n); else return toast('Ten numbers at most.'); sfx.click(); paint(); }
    function clearDraw() { $$('.kc', grid).forEach(c => c.classList.remove('drawn', 'hit')); balls.innerHTML = ''; }
    function paint() {
      store.set('keno:picks', [...picks]); $$('.kc', grid).forEach(c => c.classList.toggle('on', picks.has(+c.dataset.n)));
      info.textContent = picks.size ? picks.size + ' picked · ten balls will be drawn' : 'Pick 1 to 10 numbers'; const T = K[picks.size] || [];
      side.innerHTML = ''; side.append(payTable(picks.size ? 'Pays for ' + picks.size + ' pick' + (picks.size > 1 ? 's' : '') : 'Pick numbers', T.map((m, hh) => [hh + ' hit' + (hh === 1 ? '' : 's'), m ? fmtX(m) : '–', 'h' + hh]).filter(r => r[1] !== '–').reverse(), 'Ten of the forty numbers are drawn.'));
    }
    const qp = h('button', { class: 'btn sm lockable', onclick: () => { clearDraw(); const n = picks.size || 5; picks = new Set(); while (picks.size < n) picks.add(1 + Math.floor(Math.random() * 40)); sfx.chip(); paint(); } }, 'Quick pick');
    const cl = h('button', { class: 'btn sm lockable', onclick: () => { clearDraw(); picks.clear(); paint(); } }, 'Clear picks');
    const bar = betBar(def, { label: 'Draw', go: draw, extra: [qp, cl] }); F.bar.append(bar.el); paint();
    async function draw() {
      if (!picks.size) return toast('Pick some numbers first.', 'err');
      await act(async () => {
        const rep = await call('keno', { bet: bar.bet, picks: [...picks] }, { hold: true }), r = rep.r; clearDraw(); let hits = 0;
        await animate(async () => { for (const n of r.drawn) { const c = grid.querySelector(`[data-n="${n}"]`), hit = picks.has(n); c.classList.add('drawn'); if (hit) { c.classList.add('hit'); hits++; sfx.pop(); } else sfx.tick(); balls.append(h('span', { class: 'kb' + (hit ? ' hit' : '') }, n)); info.textContent = hits + ' hit' + (hits === 1 ? '' : 's') + ' so far'; await wait(330); } });
        info.textContent = r.hits + ' of ' + picks.size + ' hit · ' + (r.mult ? fmtX(r.mult) : 'no pay'); $$('tr', side).forEach(tr => tr.classList.toggle('lit', tr.dataset.k === 'h' + r.hits));
        finish('keno', r.bet, r.win, r.hits + ' hits', F.main);
      });
    }
    return { root: F.root, primary: draw };
  } });

// ---------- Scratch Cards ----------
const SCR_SYM = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣', '👑'], SCR_X = [1000, 250, 50, 10, 5, 2, 1];
defGame({ id: 'scratch', title: 'Scratch Cards', group: 'machine', icon: '🎟️', c1: '#2fa36b', c2: '#0c3a24', blurb: 'Three alike wins',
  mount() {
    const def = this, costs = (S.tables && S.tables.scratch) || [10, 50, 200]; let tier = store.get('scratch:tier', 0), cur = null, left = 0;
    const F = gameFrame(def, payTable('Three alike pays', SCR_SYM.map((s, i) => [s + s + s, SCR_X[i] + 'x the card']), 'Scratch with the mouse or a finger, or reveal all.'));
    const card = h('div', { class: 'scard t' + tier }), title = h('div', { class: 'sc-t' }, 'LUCKY 3'), cells = h('div', { class: 'sc-cells' }), msg = h('div', { class: 'sc-m' }, 'Buy a card to play');
    card.append(title, cells, msg); F.main.append(h('div', { class: 'sbox' }, card));
    const tiers = h('div', { class: 'seg' }, h('span', null, 'Card'), ...costs.map((c, i) => h('button', { class: 'btn sm lockable' + (i === tier ? ' sel' : ''), 'data-t': i, onclick: () => setTier(i) }, ['Bronze', 'Silver', 'Gold'][i] + ' · ' + c)));
    function setTier(i) { if (cur) return; tier = i; store.set('scratch:tier', i); $$('button', tiers).forEach(b => b.classList.toggle('sel', +b.dataset.t === i)); card.className = 'scard t' + i; F.bar.querySelector('.bb-v').textContent = fmt(costs[i]); sfx.click(); }
    const reveal = h('button', { class: 'btn sm', onclick: () => revealAll() }, 'Reveal all');
    const bar = h('div', { class: 'betbar' }, h('div', { class: 'bb-amt' }, h('span', { class: 'bb-l' }, 'Card costs'), h('b', { class: 'bb-v num' }, fmt(costs[tier]))), tiers, h('div', { class: 'bb-extra' }, reveal), h('button', { class: 'btn big gold bb-go lockable', onclick: () => buy() }, 'Buy card'));
    F.bar.append(bar);
    function blank() { cells.innerHTML = ''; for (let i = 0; i < 9; i++) cells.append(h('div', { class: 'scell' }, h('span', null, '?'))); }
    blank();
    async function buy() {
      if (cur) return revealAll();
      await act(async () => {
        const rep = await call('scratch', { tier }, { hold: true }); cur = rep.r; left = 9; cells.innerHTML = ''; msg.textContent = 'Scratch all nine boxes';
        cur.cells.forEach((s, i) => { const cell = h('div', { class: 'scell' }, h('span', null, s)), cv = h('canvas', { width: 120, height: 120 }); cell.append(cv); cells.append(cell); coat(cv, cell); });
      });
    }
    function coat(cv, cell) {
      const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 120, 120); g.addColorStop(0, '#c9ccd6'); g.addColorStop(0.5, '#eef0f6'); g.addColorStop(1, '#a9adba'); c.fillStyle = g; c.fillRect(0, 0, 120, 120);
      c.fillStyle = '#8a8fa0'; c.font = 'bold 22px system-ui'; c.textAlign = 'center'; c.fillText('★', 60, 68);
      let rub = 0, down = false;
      const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 120 / r.width, (e.clientY - r.top) * 120 / r.height]; };
      const scrub = e => { if (!down || cell.classList.contains('open')) return; const [x, y] = at(e); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(x, y, 16, 0, 7); c.fill(); rub++; if (rub % 4 === 0) sfx.flip(); if (rub > 22) open(cell); };
      cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture(e.pointerId); scrub(e); });
      cv.addEventListener('pointermove', scrub); cv.addEventListener('pointerup', () => { down = false; });
      cv.addEventListener('dblclick', () => open(cell));
    }
    function open(cell) { if (cell.classList.contains('open')) return; cell.classList.add('open'); left--; if (left <= 0) done(); }
    function revealAll() { if (!cur) return; $$('.scell', cells).forEach(open); }
    function done() {
      const r = cur; cur = null; const w = r.mult ? SCR_SYM[SCR_X.indexOf(r.mult)] : null;
      if (w) $$('.scell', cells).forEach(c => c.classList.toggle('lit', c.textContent === w));
      msg.textContent = r.mult ? 'Three ' + w + ' · ' + r.mult + 'x!' : 'No three alike. Try another?';
      finish('scratch', r.bet, r.win, r.mult ? r.mult + 'x card' : '', F.main);
    }
    return { root: F.root, primary: () => buy(), key: e => { if (e.key.toLowerCase() === 'r') { revealAll(); return true; } }, busy: () => !!cur };
  } });

// ---------- Mines ----------
defGame({ id: 'mines', title: 'Mines', group: 'machine', icon: '💣', c1: '#3a5a8a', c2: '#101e33', blurb: 'Find gems, dodge mines',
  mount(opt) {
    const def = this; let mines = store.get('mines:n', 3), V = null, bet = 0;
    const info = h('div', { class: 'mstat' }); const F = gameFrame(def, h('div', null, h('div', { class: 'ptab' }, h('h3', null, 'This round'), info), h('p', { class: 'pnote' }, 'Every safe tile raises the multiplier. Cash out whenever you like; a mine loses the bet.')));
    const grid = h('div', { class: 'mgrid' }); for (let i = 0; i < 25; i++) grid.append(h('button', { class: 'mt', 'data-i': i, onclick: () => pickT(i) }));
    F.main.append(h('div', { class: 'felt mfelt' }, grid));
    const mc = h('div', { class: 'seg' }, h('span', null, 'Mines')); const mInp = h('b', { class: 'num mn' }, mines);
    const setM = v => { if (V && !V.over) return; mines = clamp(v, 1, 24); store.set('mines:n', mines); mInp.textContent = mines; paintInfo(); };
    mc.append(h('button', { class: 'btn sm lockable', onclick: () => setM(mines - 1) }, '−'), mInp, h('button', { class: 'btn sm lockable', onclick: () => setM(mines + 1) }, '+'), ...[1, 3, 5, 10, 24].map(v => h('button', { class: 'btn sm lockable', onclick: () => setM(v) }, v)));
    const cash = h('button', { class: 'btn big green', onclick: () => cashOut() }, 'Cash out');
    const bar = betBar(def, { label: 'Start', go: startR, extra: [mc] }); F.bar.append(bar.el); bar.el.append(cash);
    const playing = () => V && !V.over;
    function paintInfo() {
      const k = V ? V.picked.length : 0, safeLeft = 25 - mines - k, tilesLeft = 25 - k;
      info.innerHTML = `<div><small>Multiplier</small><b class="gold">${fmtX(V ? V.mult : 1)}</b></div><div><small>Next tile</small><b>${V && V.next ? fmtX(V.next) : '–'}</b></div><div><small>Chance next is safe</small><b>${tilesLeft ? Math.round(safeLeft / tilesLeft * 100) : 0}%</b></div><div><small>Cash out now</small><b>${playing() && k ? fmt(Math.floor(bet * V.mult)) : '–'}</b></div>`;
    }
    function refresh() { const p = playing(); bar.prim.classList.toggle('hidden', p); cash.classList.toggle('hidden', !p); cash.disabled = !p || !V.picked.length || S.busy; cash.textContent = p && V.picked.length ? 'Cash out ' + fmt(Math.floor(bet * V.mult)) : 'Cash out'; grid.classList.toggle('live', p); paintInfo(); }
    function paint(v) {
      $$('.mt', grid).forEach((t, i) => {
        const gem = v.picked.includes(i), bomb = v.bombs && v.bombs.includes(i);
        t.className = 'mt' + (gem ? ' gem' : '') + (bomb ? ' bomb' : '') + (v.hit === i ? ' hit' : '') + (v.over && !gem && !bomb ? ' dim' : '');
        t.textContent = gem ? '💎' : bomb ? '💣' : '';
      });
    }
    async function startR() {
      if (playing()) return;
      await act(async () => { const rep = await call('mines', { act: 'start', bet: bar.bet, mines }); V = rep.r.view; bet = rep.r.bet; paint(V); sfx.chip(); refresh(); });
    }
    async function pickT(i) {
      if (!playing() || V.picked.includes(i)) return;
      await act(async () => {
        const rep = await call('mines', { act: 'pick', i }, { hold: true }); V = rep.r.view;
        if (V.over && !V.cashed) { sfx.boom(); paint(V); refresh(); await animate(() => wait(500)); finish('mines', rep.r.bet, 0, 'Boom!', F.main); return; }
        sfx.pop(); paint(V); refresh();
        if (V.over) finish('mines', rep.r.bet, rep.r.win, 'Cleared the board at ' + fmtX(V.mult), F.main); else releaseBal();
      });
    }
    async function cashOut() {
      if (!playing() || !V.picked.length) return;
      await act(async () => { const rep = await call('mines', { act: 'cash' }, { hold: true }); V = rep.r.view; paint(V); refresh(); finish('mines', rep.r.bet, rep.r.win, 'Cashed out at ' + fmtX(V.mult), F.main); });
    }
    async function start() { refresh(); try { const rep = await call('mines', { act: 'state' }); if (rep.r && rep.r.resume) { V = rep.r.view; bet = rep.r.bet; bar.bet = bet; mines = V.mines; mInp.textContent = mines; paint(V); refresh(); toast('Your round is back.'); } } catch {} }
    return { root: F.root, start, refresh, primary: () => (playing() ? cashOut() : startR()) };
  } });

// ---------- Hi-Lo ----------
defGame({ id: 'hilo', title: 'Hi-Lo', group: 'machine', icon: '↕️', c1: '#2a7f9e', c2: '#0a2a36', blurb: 'Higher or lower?', hint: '↑ higher · ↓ lower · C cash out',
  mount() {
    const def = this; let V = null, bet = 0, suit = 0;
    const F = gameFrame(def, payTable('Hi-Lo', [['Higher', 'pays more the less likely it is'], ['Same card again', 'free redo'], ['Cash out', 'any time after one guess'], ['Top prize', '20 guesses or 5000x']], 'Aces are low, Kings high.'));
    const cardBox = h('div', { class: 'hlcard' }), trail = h('div', { class: 'hltrail' }), mult = h('div', { class: 'hlmult' }, '1x');
    const hi = h('button', { class: 'btn big hlb hi lockable', onclick: () => guess('hi') }), lo = h('button', { class: 'btn big hlb lo lockable', onclick: () => guess('lo') });
    F.main.append(h('div', { class: 'felt hlfelt' }, h('div', { class: 'hlmid' }, lo, h('div', { class: 'hlc' }, cardBox, mult), hi), trail));
    cardBox.append(cardEl(null, true));
    const cash = h('button', { class: 'btn big green', onclick: () => cashOut() }, 'Cash out');
    const bar = betBar(def, { label: 'Start', go: startR }); F.bar.append(bar.el); bar.el.append(cash);
    const playing = () => V && !V.over;
    function refresh() {
      const p = playing(); bar.prim.classList.toggle('hidden', p); cash.classList.toggle('hidden', !p); cash.disabled = !p || !V.n || S.busy;
      cash.textContent = p && V.n ? 'Cash out ' + fmt(Math.floor(bet * V.mult)) : 'Cash out';
      const c = V ? V.card : 7;
      hi.innerHTML = `▲ Higher<small>${p && V.hiX ? fmtX(V.hiX) + ' · ' + Math.round((13 - c) / 13 * 100) + '%' : '–'}</small>`;
      lo.innerHTML = `▼ Lower<small>${p && V.loX ? fmtX(V.loX) + ' · ' + Math.round((c - 1) / 13 * 100) + '%' : '–'}</small>`;
      hi.disabled = !p || !V.hiX; lo.disabled = !p || !V.loX; mult.textContent = V ? fmtX(V.mult || 0) : '1x';
    }
    async function showCard(c, s) { const el = cardBox.firstChild; el.classList.add('down'); await wait(180); await flipUp(el, { r: c, s }); }
    async function startR() {
      if (playing()) return;
      await act(async () => { const rep = await call('hilo', { act: 'start', bet: bar.bet }); V = rep.r.view; bet = rep.r.bet; suit = V.suit != null ? V.suit : Math.floor(Math.random() * 4); trail.innerHTML = ''; refresh(); await animate(() => showCard(V.card, suit)); refresh(); });
    }
    async function guess(g) {
      if (!playing()) return;
      await act(async () => {
        const was = V.card, ws = suit, rep = await call('hilo', { act: 'guess', g }, { hold: true }); V = rep.r.view; suit = V.suit != null ? V.suit : Math.floor(Math.random() * 4);
        trail.append(h('span', { class: 'ht' }, cardEl({ r: was, s: ws }, false), h('small', null, g === 'hi' ? '▲' : '▼')));
        while (trail.children.length > 9) trail.firstChild.remove();
        await animate(() => showCard(V.card, suit));
        if (V.same) toast('Same card: guess again.'); refresh();
        if (V.over) finish('hilo', rep.r.bet, rep.r.win, V.cashed ? 'Top prize ' + fmtX(V.mult) : 'Wrong guess', F.main); else { releaseBal(); sfx.coin(); }
      });
    }
    async function cashOut() {
      if (!playing() || !V.n) return;
      await act(async () => { const rep = await call('hilo', { act: 'cash' }, { hold: true }); V = rep.r.view; refresh(); finish('hilo', rep.r.bet, rep.r.win, 'Cashed out at ' + fmtX(V.mult), F.main); });
    }
    async function start() { refresh(); try { const rep = await call('hilo', { act: 'state' }); if (rep.r && rep.r.resume) { V = rep.r.view; bet = rep.r.bet; bar.bet = bet; S.instant = true; await showCard(V.card, suit); S.instant = false; refresh(); toast('Your round is back.'); } } catch {} }
    return { root: F.root, start, refresh, primary: () => (playing() ? cashOut() : startR()), key: e => { if (e.key === 'ArrowUp') { guess('hi'); return true; } if (e.key === 'ArrowDown') { guess('lo'); return true; } if (e.key.toLowerCase() === 'c') { cashOut(); return true; } } };
  } });

// ---------- Dice ----------
defGame({ id: 'dice', title: 'Dice', group: 'machine', icon: '💯', c1: '#4c5bd4', c2: '#141a4a', blurb: 'Roll over or under',
  mount() {
    const def = this; let target = store.get('dice:t', 50), over = store.get('dice:o', true);
    const F = gameFrame(def, payTable('Dice', [['Roll', '0.00 to 99.99'], ['Pays', '99 ÷ your chance'], ['50% chance', '1.98x'], ['10% chance', '9.9x'], ['2% chance', '49.5x']], 'Over wins when the roll is at least your number; under wins when it is below it.'));
    const num = h('div', { class: 'dnum num' }, '50.00'), track = h('div', { class: 'dtrack' }), fillL = h('div', { class: 'dfill' }), mark = h('div', { class: 'dmark' });
    const rng = h('input', { type: 'range', min: 2, max: 98, value: target, class: 'drange', oninput: () => { target = +rng.value; store.set('dice:t', target); paint(); } });
    track.append(fillL, rng, mark);
    const stats = h('div', { class: 'dstats' }), ou = h('button', { class: 'btn lockable', onclick: () => { over = !over; store.set('dice:o', over); sfx.click(); paint(); } });
    F.main.append(h('div', { class: 'felt dfelt' }, num, track, h('div', { class: 'dticks' }, h('span', null, '0'), h('span', null, '25'), h('span', null, '50'), h('span', null, '75'), h('span', null, '100')), h('div', { class: 'drow' }, ou, stats)));
    const bar = betBar(def, { label: 'Roll', go: roll, onChange: () => paint() }); F.bar.append(bar.el);
    function paint() {
      const ch = over ? 100 - target : target, m = Math.round(9900 / ch) / 100;
      fillL.style.cssText = over ? `left:${target}%;right:0` : `left:0;right:${100 - target}%`;
      ou.textContent = over ? 'Roll over ' + target : 'Roll under ' + target;
      stats.innerHTML = `<div><small>Win chance</small><b>${ch}%</b></div><div><small>Pays</small><b class="gold">${fmtX(m)}</b></div><div><small>Win</small><b>${fmt(Math.floor(bar.bet * 99 / ch))}</b></div>`;
    }
    paint();
    async function roll() {
      await act(async () => {
        const rep = await call('dice', { bet: bar.bet, target, over }, { hold: true }), r = rep.r; mark.classList.remove('w', 'l'); sfx.roll();
        await animate(() => tween(900, (e, p) => { const v = p < 1 ? Math.random() * 100 : r.roll; num.textContent = (p < 1 ? v : r.roll).toFixed(2); mark.style.left = (p < 1 ? r.roll * e : r.roll) + '%'; }));
        num.textContent = r.roll.toFixed(2); mark.style.left = r.roll + '%'; mark.classList.add(r.win ? 'w' : 'l'); num.className = 'dnum num ' + (r.win ? 'w' : 'l');
        finish('dice', r.bet, r.win, 'Rolled ' + r.roll.toFixed(2), F.main);
      });
    }
    return { root: F.root, primary: roll };
  } });

// ---------- Coin Flip ----------
defGame({ id: 'coin', title: 'Coin Flip', group: 'machine', icon: '🪙', c1: '#b8861b', c2: '#3f2c05', blurb: 'Heads or tails, 1.96x', hint: 'H heads · T tails',
  mount() {
    const def = this; let side = store.get('coin:p', 'h');
    const F = gameFrame(def, payTable('Coin Flip', [['Right call', '1.96x'], ['Wrong call', 'nothing']], 'A fair coin; the house keeps 2%.'));
    const coin = h('div', { class: 'coin' }, h('div', { class: 'cf h' }, h('span', null, '👑'), h('small', null, 'HEADS')), h('div', { class: 'cf t' }, h('span', null, '⭐'), h('small', null, 'TAILS')));
    const hist = h('div', { class: 'chist' });
    const pk = s => h('button', { class: 'btn big cpick lockable', 'data-s': s, onclick: () => { side = s; store.set('coin:p', s); paint(); sfx.click(); } }, s === 'h' ? '👑 Heads' : '⭐ Tails');
    const picks = h('div', { class: 'cpicks' }, pk('h'), pk('t'));
    F.main.append(h('div', { class: 'felt cfelt' }, h('div', { class: 'cstage' }, coin), picks, hist));
    function paint() { $$('.cpick', picks).forEach(b => b.classList.toggle('sel', b.dataset.s === side)); }
    paint(); let rot = 0;
    const bar = betBar(def, { label: 'Flip', go: flip }); F.bar.append(bar.el);
    async function flip() {
      await act(async () => {
        const rep = await call('coin', { bet: bar.bet, pick: side }, { hold: true }), r = rep.r; sfx.flip();
        const base = Math.ceil(rot / 360) * 360 + 360 * 6, end = base + (r.side === 't' ? 180 : 0), r0 = rot;
        await animate(() => tween(1600, (e, p) => { rot = r0 + (end - r0) * e; coin.style.transform = `translateY(${-Math.sin(p * Math.PI) * 80}px) rotateY(${rot}deg)`; }));
        rot = end; coin.style.transform = `rotateY(${rot}deg)`; sfx.coin();
        hist.prepend(h('span', { class: 'ch ' + r.side }, r.side === 'h' ? '👑' : '⭐')); while (hist.children.length > 14) hist.lastChild.remove();
        finish('coin', r.bet, r.win, r.side === 'h' ? 'Heads' : 'Tails', F.main);
      });
    }
    return { root: F.root, primary: flip, key: e => { const k = e.key.toLowerCase(); if (k === 'h' || k === 't') { side = k; store.set('coin:p', k); paint(); return true; } } };
  } });

// ---------- Rocket (instant) and the rocket graph shared with Live Rocket ----------
function rocketGraph(cv) {
  const G = { m: 1, state: 'idle', target: 0, cashAt: 0, crashed: 0, label: '' };
  G.draw = () => {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height; if (!W || !H) return; c.clearRect(0, 0, W, H);
    const top = Math.max(2, G.m * 1.25, G.target && G.target < 50 ? G.target * 1.1 : 0), pad = 40 * (W / Math.max(1, cv.clientWidth)), ly = v => H - pad - (Math.log(v) / Math.log(top)) * (H - pad * 2), lx = p => pad + p * (W - pad * 2);
    c.strokeStyle = '#ffffff18'; c.lineWidth = 1; c.fillStyle = '#9aa1c2'; c.font = Math.round(pad * 0.32) + 'px system-ui'; c.textAlign = 'left';
    for (const v of [1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200]) { if (v > top) break; const y = ly(v); c.beginPath(); c.moveTo(pad, y); c.lineTo(W - pad * 0.3, y); c.stroke(); c.fillText(v + 'x', 4, y + 4); }
    if (G.target) { const y = ly(Math.min(G.target, top)); c.strokeStyle = '#3ee08a88'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(pad, y); c.lineTo(W, y); c.stroke(); c.setLineDash([]); }
    const steps = 60, pts = []; for (let i = 0; i <= steps; i++) { const p = i / steps; pts.push([lx(p * 0.85), ly(Math.exp(Math.log(G.m) * p))]); }
    const grd = c.createLinearGradient(0, H, 0, 0); grd.addColorStop(0, '#ff7a3b33'); grd.addColorStop(1, '#ff3b5c55');
    c.beginPath(); c.moveTo(pts[0][0], H - pad); pts.forEach(p => c.lineTo(p[0], p[1])); c.lineTo(pts[steps][0], H - pad); c.closePath(); c.fillStyle = G.crashed ? '#ff3b5c22' : grd; c.fill();
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.strokeStyle = G.crashed ? '#ff4f5e' : '#ffb43b'; c.lineWidth = 4 * (W / Math.max(1, cv.clientWidth)); c.stroke();
    const [rx, ry] = pts[steps]; c.font = Math.round(pad * 0.9) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(G.crashed ? '💥' : G.state === 'idle' ? '' : '🚀', rx, ry);
    if (G.cashAt) { const y = ly(Math.min(G.cashAt, top)); c.fillStyle = '#3ee08a'; c.beginPath(); c.arc(lx(0.85 * Math.log(G.cashAt) / Math.log(Math.max(G.m, 1.0001))), y, pad * 0.18, 0, 7); c.fill(); }
  };
  return G;
}
defGame({ id: 'crashx', title: 'Rocket', group: 'machine', icon: '🚀', c1: '#d2462d', c2: '#3e0f08', blurb: 'Pick a cash-out, watch it fly',
  mount() {
    const def = this; let target = store.get('crashx:t', 2);
    const F = gameFrame(def, payTable('Rocket', [['Reaches your cash-out', 'you win bet × cash-out'], ['Blows up first', 'you lose the bet'], ['Chance to reach 2x', 'about 48%'], ['Chance to reach 10x', 'about 9.7%']], 'Each flight is decided on the server the moment you bet.'));
    const cv = h('canvas', { class: 'rcv' }), big = h('div', { class: 'rbig num' }, '1.00x'), G = rocketGraph(cv);
    F.main.append(h('div', { class: 'rbox' }, cv, big));
    const unfit = fitCanvas(cv, G.draw);
    const inp = h('input', { class: 'inp num', type: 'number', min: 1.01, max: 1000, step: 0.01, value: target, oninput: () => { target = clamp(+inp.value || 2, 1.01, 1000); store.set('crashx:t', target); G.target = target; G.draw(); } });
    const tg = h('div', { class: 'seg' }, h('span', null, 'Cash out at'), inp, ...[1.5, 2, 3, 5, 10].map(v => h('button', { class: 'btn sm lockable', onclick: () => { inp.value = v; inp.oninput(); } }, v + 'x')));
    G.target = target;
    const bar = betBar(def, { label: 'Launch', go: launch, extra: [tg] }); F.bar.append(bar.el);
    async function launch() {
      await act(async () => {
        const rep = await call('crashx', { bet: bar.bet, target }, { hold: true }), r = rep.r; G.crashed = 0; G.cashAt = 0; G.state = 'fly'; big.className = 'rbig num'; G.target = r.target;
        const end = r.crash, T = Math.min(6500, 1200 + 1300 * Math.log(Math.max(1.01, end))); let cashed = false;
        await animate(() => tween(T, (e, p) => { G.m = Math.exp(Math.log(end) * p); if (!cashed && r.win && G.m >= r.target) { cashed = true; G.cashAt = r.target; sfx.coin(); big.classList.add('w'); } big.textContent = (r.win && G.m >= r.target ? 'Cashed ' + fmtX(r.target) + ' · ' : '') + G.m.toFixed(2) + 'x'; G.draw(); }, ease.lin));
        G.m = end; G.crashed = 1; if (r.win) G.cashAt = r.target; G.draw(); sfx.boom(); big.textContent = (r.win ? 'Cashed ' + fmtX(r.target) + ' · ' : '') + 'Blew up at ' + end.toFixed(2) + 'x'; big.classList.add(r.win ? 'w' : 'l');
        finish('crashx', r.bet, r.win, 'Crashed at ' + fmtX(end), F.main);
      });
    }
    return { root: F.root, primary: launch, unmount: unfit };
  } });
