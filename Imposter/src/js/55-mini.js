// ==========================================
// TASK MINI-GAMES (one canvas, pointer driven)
// ==========================================
let MINI = null;
const MW = 520, MH = 380;
const WCOL = ['#e2574c', '#4c8fd6', '#e7c04a', '#b86ad6'];
function mtext(c, s, x, y, size, col, al) { c.fillStyle = col || '#f6e6bf'; c.font = '700 ' + (size || 18) + 'px Georgia,"Palatino Linotype",serif'; c.textAlign = al || 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y); }
function mbtn(c, x, y, w, h, label, on) { c.fillStyle = on ? '#b8892e' : '#e9b955'; rr(c, x, y, w, h, 14); c.fill(); mtext(c, label, x + w / 2, y + h / 2, 22, '#2a1a08'); }
const inRect = (px, py, x, y, w, h) => px >= x && px <= x + w && py >= y && py <= y + h;

const MG = {
  wires() {
    const right = shuffle([0, 1, 2, 3]), link = [-1, -1, -1, -1]; let drag = null;
    return {
      hint: 'Drag each bell cord to the hook of the same colour.', dbg: () => right,
      down(x, y) { for (let i = 0; i < 4; i++) if (link[i] < 0 && Math.hypot(x - 50, y - (70 + i * 80)) < 34) drag = { i, x, y }; },
      move(x, y) { if (drag) { drag.x = x; drag.y = y; } },
      up(x, y) {
        if (!drag) return; const d = drag; drag = null;
        for (let j = 0; j < 4; j++) if (x > 400 && Math.abs(y - (70 + j * 80)) < 36) { if (right[j] === d.i) { link[d.i] = j; sfx.click(); this.done = link.every(v => v >= 0); } else sfx.bad(); }
      },
      draw(c) {
        for (let i = 0; i < 4; i++) {
          const y = 70 + i * 80; c.lineCap = 'round'; c.lineWidth = 12; c.strokeStyle = WCOL[i];
          if (link[i] >= 0) { c.beginPath(); c.moveTo(50, y); c.bezierCurveTo(250, y, 250, 70 + link[i] * 80, 470, 70 + link[i] * 80); c.stroke(); c.save(); c.setLineDash([3, 6]); c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,.28)'; c.stroke(); c.restore(); }
          c.fillStyle = '#8a6a2c'; rr(c, 14, y - 22, 40, 44, 8); c.fill(); c.fillStyle = WCOL[i]; c.fillRect(34, y - 8, 20, 16);
          const ry = 70 + i * 80; c.fillStyle = '#8a6a2c'; rr(c, 466, ry - 22, 40, 44, 8); c.fill(); c.fillStyle = WCOL[right[i]]; c.fillRect(466, ry - 8, 20, 16);
        }
        if (drag) { c.lineWidth = 12; c.strokeStyle = WCOL[drag.i]; c.beginPath(); c.moveTo(50, 70 + drag.i * 80); c.lineTo(drag.x, drag.y); c.stroke(); c.fillStyle = WCOL[drag.i]; c.beginPath(); c.arc(drag.x, drag.y, 9, 0, TAU); c.fill(); }
      }
    };
  },
  swipe() {
    let cx = 70, drag = false, t0 = -1, msg = 'Pull the punch-card through the music box', mt = 0;
    return {
      hint: 'Drag the card across the comb at a steady pace, not too fast, not too slow.',
      down(x, y) { if (inRect(x, y, cx - 10, 195, 130, 80)) { drag = true; t0 = -1; } },
      move(x) { if (!drag) return; cx = clamp(x - 55, 20, 440); if (t0 < 0 && cx > 150) t0 = performance.now(); },
      up() {
        if (!drag) return; drag = false;
        if (cx > 400 && t0 > 0) { const dt = (performance.now() - t0) / 1000; if (dt >= .4 && dt <= 1.1) { this.done = true; msg = 'A sweet tune!'; sfx.ok(); return; } msg = dt < .4 ? 'Too fast, the notes jangle' : 'Too slow, the tune drags'; sfx.bad(); }
        else if (cx > 150) { msg = 'It jammed. Try again'; sfx.bad(); } cx = 70; t0 = -1;
      },
      draw(c) {
        c.fillStyle = '#5a3a1e'; rr(c, 90, 90, 340, 80, 16); c.fill(); c.fillStyle = '#1a110a'; rr(c, 110, 125, 300, 14, 7); c.fill();
        c.fillStyle = this.done ? '#a5e06a' : '#ff6a3d'; c.beginPath(); c.arc(405, 108, 6, 0, TAU); c.fill();
        mtext(c, msg, 260, 50, 20, this.done ? '#a5e06a' : '#f6e6bf');
        c.fillStyle = '#f0deae'; rr(c, cx, 200, 110, 70, 4); c.fill(); c.fillStyle = '#2a1a08'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(cx + 14 + i * 14, 222 + ((i * 5) % 3) * 12, 3.4, 0, TAU); c.fill(); } c.fillStyle = '#c9a050'; for (let i = 0; i < 6; i++) c.fillRect(cx + 4, 203 + i * 11.5, 3, 5);
      }
    };
  },
  align() {
    const y = [95 + rnd(-1, 1) * 120, 285 + rnd(-1, 1) * 120], mid = [95, 285]; let drag = -1;
    if (Math.abs(y[0] - mid[0]) < 30) y[0] -= 70; if (Math.abs(y[1] - mid[1]) < 30) y[1] += 70;
    y[0] = clamp(y[0], 30, 170); y[1] = clamp(y[1], 210, 350);
    const ok = i => Math.abs(y[i] - mid[i]) < 7;
    return {
      hint: 'Drag both wicks level with the dashed lines.', dbg: () => ({ y, mid }),
      down(px, py) { for (let i = 0; i < 2; i++) if (Math.hypot(px - 120, py - y[i]) < 34) drag = i; },
      move(px, py) { if (drag >= 0) y[drag] = clamp(py, mid[drag] - 90 - 40, mid[drag] + 90 + 40); },
      up() { if (drag >= 0) { if (ok(drag)) { y[drag] = mid[drag]; sfx.click(); } drag = -1; if (ok(0) && ok(1)) this.done = true; } },
      draw(c) {
        for (let i = 0; i < 2; i++) {
          c.fillStyle = '#3a2614'; rr(c, 108, mid[i] - 100, 24, 200, 12); c.fill();
          c.strokeStyle = ok(i) ? '#a5e06a' : '#ffd36b'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(130, mid[i]); c.lineTo(480, mid[i]); c.stroke(); c.setLineDash([]);
          c.strokeStyle = '#e9b955'; c.lineWidth = 5; c.beginPath(); c.moveTo(130, y[i]); c.lineTo(480, mid[i]); c.stroke();
          c.fillStyle = ok(i) ? '#a5e06a' : '#e9b955'; c.beginPath(); c.arc(120, y[i], 22, 0, TAU); c.fill(); c.strokeStyle = '#2a1a08'; c.stroke();
          c.fillStyle = '#7a5a30'; rr(c, 470, mid[i] - 24, 40, 48, 8); c.fill();
        }
      }
    };
  },
  upload() {
    let p = -1;
    return {
      hint: 'Press the button and wait while the logbook is copied.',
      down(x, y) { if (p < 0 && inRect(x, y, 170, 250, 180, 56)) { p = 0; sfx.click(); } },
      upd(dt) { if (p >= 0 && !this.done) { p += dt / 7; if (p >= 1) { p = 1; this.done = true; sfx.ok(); } } },
      draw(c, t) {
        mtext(c, p < 0 ? 'Ready to copy' : p >= 1 ? 'Logbook copied!' : 'Copying... ' + Math.floor(p * 100) + '%', 260, 40, 22);
        c.fillStyle = '#7a5a30'; rr(c, 40, 80, 120, 110, 12); c.fill(); mtext(c, 'OLD LOG', 100, 135, 18); c.fillStyle = '#7a5a30'; rr(c, 360, 80, 120, 110, 12); c.fill(); mtext(c, 'NEW LOG', 420, 135, 18);
        if (p >= 0) for (let i = 0; i < 4; i++) { const k = ((t * .8 + i / 4) % 1); c.fillStyle = '#f0deae'; rr(c, 160 + k * 170, 112 + Math.sin(k * 9) * 10, 22, 28, 2); c.fill(); c.fillStyle = '#7a5a30'; c.fillRect(164 + k * 170, 118 + Math.sin(k * 9) * 10, 14, 2); c.fillRect(164 + k * 170, 124 + Math.sin(k * 9) * 10, 10, 2); }
        c.fillStyle = '#1a110a'; rr(c, 60, 210, 400, 26, 13); c.fill(); if (p > 0) { c.fillStyle = '#a5e06a'; rr(c, 60, 210, Math.max(26, 400 * p), 26, 13); c.fill(); }
        if (p < 0) mbtn(c, 170, 250, 180, 56, 'COPY');
      }
    };
  },
  fuel() {
    let f = 0, hold = false;
    return {
      hint: 'Hold the button to pour until the lamp reservoir is full.',
      down(x, y) { if (inRect(x, y, 170, 285, 180, 70)) hold = true; }, up() { hold = false; }, move() { },
      upd(dt) { if (hold && !this.done) { f = Math.min(1, f + dt * .21); if (f >= 1) { this.done = true; sfx.ok(); } } else if (!this.done) f = Math.max(0, f - dt * .02); },
      draw(c, t) {
        c.fillStyle = '#241810'; rr(c, 190, 30, 140, 230, 16); c.fill(); c.strokeStyle = '#c9a050'; c.lineWidth = 4; c.stroke();
        c.save(); rr(c, 190, 30, 140, 230, 16); c.clip(); c.fillStyle = '#ff9f45'; c.fillRect(190, 260 - 230 * f, 140, 230 * f + 4); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(190, 260 - 230 * f, 140, 6); c.restore();
        c.strokeStyle = '#a5e06a'; c.lineWidth = 3; c.beginPath(); c.moveTo(180, 34); c.lineTo(340, 34); c.stroke(); mtext(c, Math.floor(f * 100) + '%', 260, 150, 30, '#fff');
        mbtn(c, 170, 285, 180, 70, hold ? 'POURING...' : 'HOLD TO POUR', hold);
      }
    };
  },
  rocks() {
    const A = []; let hit = 0, sp = 0, mx = -99, my = -99; const NEED = 12;
    return {
      hint: 'Click the gulls to shoo them off the lamp room (12 needed).', dbg: () => A,
      down(x, y) { mx = x; my = y; for (let i = A.length - 1; i >= 0; i--) if (Math.hypot(x - A[i].x, y - A[i].y) < A[i].r + 8) { A[i].boom = .25; A[i].hit = 1; break; } },
      move(x, y) { mx = x; my = y; },
      upd(dt) {
        if (this.done) return; sp -= dt; if (sp <= 0 && A.filter(a => !a.boom).length < 6) { sp = rnd(.35, .8); const s = rint(0, 3), r = rnd(14, 26); const a = { x: s === 0 ? -20 : s === 1 ? MW + 20 : rnd(40, MW - 40), y: s === 2 ? -20 : s === 3 ? MH + 20 : rnd(40, MH - 40), r, vx: 0, vy: 0, rot: rnd(0, 6) }; const ang = Math.atan2(rnd(80, 300) - a.y, rnd(80, 440) - a.x), v = rnd(50, 110); a.vx = Math.cos(ang) * v; a.vy = Math.sin(ang) * v; A.push(a); }
        for (let i = A.length - 1; i >= 0; i--) { const a = A[i]; if (a.boom) { a.boom -= dt; if (a.boom <= 0) { if (a.hit) { hit++; sfx.click(); } A.splice(i, 1); if (hit >= NEED) { this.done = true; sfx.ok(); } } continue; } a.x += a.vx * dt; a.y += a.vy * dt; a.rot += dt; if (a.x < -60 || a.x > MW + 60 || a.y < -60 || a.y > MH + 60) A.splice(i, 1); }
      },
      draw(c, t) {
        const sk = c.createLinearGradient(0, 0, 0, MH); sk.addColorStop(0, '#26384a'); sk.addColorStop(.7, '#8a6a58'); sk.addColorStop(1, '#c9955a'); c.fillStyle = sk; c.fillRect(0, 0, MW, MH);
        c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 5; i++) { const cx = ((i * 197 + t * 10) % (MW + 200)) - 100; c.beginPath(); c.ellipse(cx, 60 + i * 55, 90, 14, 0, 0, TAU); c.fill(); }
        for (const a of A) { c.save(); c.translate(a.x, a.y); if (a.boom) { c.globalAlpha = a.boom * 4; c.fillStyle = '#fff1a8'; c.beginPath(); c.arc(0, 0, a.r * (2 - a.boom * 4), 0, TAU); c.fill(); for (let q = 0; q < 6; q++) { c.fillRect(Math.cos(q) * a.r * 1.6, Math.sin(q * 2) * a.r * 1.4, 3, 3); } }
          else { const fl = Math.sin(a.rot * 9) * .5; c.scale(a.vx < 0 ? -1 : 1, 1); c.strokeStyle = '#f4efe4'; c.lineCap = 'round'; c.lineWidth = a.r * .34; c.beginPath(); c.moveTo(-a.r * 1.5, -a.r * (.5 + fl)); c.quadraticCurveTo(-a.r * .6, -a.r * (.9 + fl), 0, 0); c.quadraticCurveTo(a.r * .6, -a.r * (.9 - fl), a.r * 1.5, -a.r * (.5 - fl)); c.stroke(); c.fillStyle = '#f4efe4'; c.beginPath(); c.ellipse(0, 1, a.r * .5, a.r * .34, 0, 0, TAU); c.fill(); c.fillStyle = '#f2b13a'; c.beginPath(); c.moveTo(a.r * .45, 0); c.lineTo(a.r * .9, 2); c.lineTo(a.r * .45, 4); c.fill(); }
          c.restore(); }
        if (mx > -50) { c.strokeStyle = '#fff1a8'; c.lineWidth = 2; c.beginPath(); c.arc(mx, my, 16, 0, TAU); c.moveTo(mx - 24, my); c.lineTo(mx + 24, my); c.moveTo(mx, my - 24); c.lineTo(mx, my + 24); c.stroke(); }
        mtext(c, 'Shooed ' + hit + ' / ' + NEED, 90, 20, 16);
      }
    };
  },
  simon() {
    const seq = []; for (let i = 0; i < 4; i++) seq.push(rint(0, 3)); let round = 1, st = 'show', idx = 0, tm = .6, lit = -1, inp = 0, shake = 0;
    const CC = ['#d9503f', '#5fae5a', '#4c8fd6', '#e7c04a'], FQ = [330, 262, 392, 440], pad = i => [150 + (i % 2) * 120, 60 + (i >> 1) * 120, 110, 110];
    return {
      hint: 'Listen to the chimes, then ring them back in the same order.', dbg: () => ({ seq, st, round }),
      down(x, y) { if (st !== 'in') return; for (let i = 0; i < 4; i++) { const p = pad(i); if (inRect(x, y, p[0], p[1], p[2], p[3])) { lit = i; tm = .22; tone(FQ[i], .2, 'triangle', .25); if (seq[inp] === i) { inp++; if (inp >= round) { if (round >= 4) { this.done = true; sfx.ok(); } else { round++; st = 'show'; idx = 0; tm = .9; lit = -1; } } } else { shake = .4; sfx.bad(); st = 'show'; idx = 0; tm = 1; inp = 0; lit = -1; } return; } } },
      upd(dt) {
        if (shake > 0) shake -= dt; if (this.done) return;
        if (lit >= 0 && st === 'in') { tm -= dt; if (tm <= 0) lit = -1; return; }
        if (st !== 'show') return; tm -= dt;
        if (tm <= 0) { if (lit >= 0) { lit = -1; tm = .25; if (idx >= round) { st = 'in'; inp = 0; } } else if (idx < round) { lit = seq[idx]; tone(FQ[lit], .3, 'triangle', .25); idx++; tm = .45; } else { st = 'in'; inp = 0; } }
      },
      draw(c) {
        mtext(c, st === 'show' ? 'Listen...' : 'Your turn!  (' + round + ' / 4)', 260, 28, 20);
        for (let i = 0; i < 4; i++) { const p = pad(i); c.save(); if (shake > 0) c.translate(Math.sin(shake * 60) * 4, 0); c.globalAlpha = lit === i ? 1 : .38; c.fillStyle = CC[i]; rr(c, p[0], p[1], p[2], p[3], 18); c.fill(); if (lit === i) { c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke(); } c.restore(); }
      }
    };
  },
  lights() {
    const on = []; for (let i = 0; i < 5; i++) on.push(Math.random() < .35); if (on.every(v => v)) on[2] = false; if (on.filter(v => !v).length < 2) on[0] = false;
    return {
      hint: 'Flip every lever up to relight the lamps.', dbg: () => on,
      down(x, y) { for (let i = 0; i < 5; i++) if (inRect(x, y, 50 + i * 90, 90, 70, 200)) { on[i] = !on[i]; sfx.click(); this.done = on.every(v => v); } },
      draw(c) {
        mtext(c, 'Lamp Room levers', 260, 40, 22);
        for (let i = 0; i < 5; i++) { const x = 50 + i * 90; c.fillStyle = '#241810'; rr(c, x, 90, 70, 200, 12); c.fill(); c.fillStyle = on[i] ? '#a5e06a' : '#ff6a3d'; c.beginPath(); c.arc(x + 35, 70, 8, 0, TAU); c.fill(); c.fillStyle = '#d9c28a'; rr(c, x + 18, on[i] ? 100 : 190, 34, 90 - 0, 10); c.fill(); }
      }
    };
  },
  reactor(st) {
    let held = false;
    return {
      hint: 'Hold the valve while another Keeper holds the other one.',
      down(x, y) { if (Math.hypot(x - 260, y - 190) < 100 && !held) { held = true; act({ t: 'hold', st, on: 1 }); } },
      up() { if (held) { held = false; act({ t: 'hold', st, on: 0 }); } },
      release() { if (held) { held = false; act({ t: 'hold', st, on: 0 }); } },
      draw(c, t) {
        const S = G.sab, other = S.hold[1 - st] >= 0;
        mtext(c, 'BOILER  ' + Math.max(0, Math.ceil(S.reactor)) + 's', 260, 34, 26, '#ff8a5c');
        c.fillStyle = held ? '#e9b955' : '#6b4a2a'; c.beginPath(); c.arc(260, 190, 100, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
        mtext(c, held ? 'HOLDING' : 'HOLD', 260, 190, 28, held ? '#2a1a08' : '#fff');
        mtext(c, other ? 'Other valve: held' : 'Other valve: waiting for a second Keeper', 260, 330, 16, other ? '#a5e06a' : '#ffd36b');
        if (S.reactor <= 0) this.done = true;
      }
    };
  }
};
const MTITLE = { wires: 'Re-string the Bell Cords', swipe: 'Feed the Music Box', align: 'Trim the Lamp Wick', upload: 'Copy the Logbook', fuel: 'Fill the Lamp Oil', rocks: 'Shoo the Gulls', simon: 'Ring the Chimes', lights: 'Relight the Lamps', reactor: 'Calm the Boiler' };
function openMini(kind, extra) {
  if (MINI || !G || G.phase !== 'play') return; const me0 = G.players[G.me]; if (!me0 || !me0.alive && kind !== 'task') return;
  let sid = -1, gk = kind; if (kind === 'task') { sid = extra; gk = MAP.stations[sid].kind; }
  const g = gk === 'reactor' ? MG.reactor(extra) : MG[gk](); MINI = { g, kind, sid, t: 0, doneT: 0, gk, st: extra };
  $('mini-title').textContent = MTITLE[gk] || 'Task'; $('mini-hint').textContent = g.hint || ''; $('mini').classList.remove('hidden');
  if (kind === 'task') act({ t: 'ts', sid });
  sfx.click();
}
function closeMini(cancel) {
  if (!MINI) return; const M = MINI; MINI = null; $('mini').classList.add('hidden');
  if (M.g.release) M.g.release();
  if (M.g.done && !cancel) {
    if (M.kind === 'task') { if (NET.guest) { const t = G.players[G.me].tasks.find(q => q.sid === M.sid); if (t) t.done = true; buildTaskList(); } act({ t: 'td', sid: M.sid }); }
    else if (M.kind === 'lights') act({ t: 'fixl' });
  }
}
function miniLoop(dt) {
  if (!MINI) return; const M = MINI; M.t += dt;
  if (!G || (G.phase !== 'play') || (G.me >= 0 && !G.players[G.me].alive && M.kind !== 'task')) return closeMini(true);
  if (M.g.upd) M.g.upd(dt);
  if (M.kind === 'reactor' && G.sab.reactor <= 0) return closeMini(true);
  if (M.kind === 'lights' && !G.sab.lights && !M.g.done) return closeMini(true);
  if (M.g.done && !M.fin) { M.fin = true; M.doneT = 0; }
  if (M.fin) { M.doneT += dt; if (M.doneT > .75) closeMini(); }
  const cv = $('minicv'), c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#2a1c12'; c.fillRect(0, 0, MW, MH); M.g.draw(c, M.t);
  if (M.fin) { mtext(c, 'DONE', 260, 190, 60, '#a5e06a'); }
}
function bindMini() {
  const cv = $('minicv'), pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * MW / r.width, (e.clientY - r.top) * MH / r.height]; };
  cv.addEventListener('pointerdown', e => { if (!MINI || MINI.fin) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { } const [x, y] = pt(e); if (MINI.g.down) MINI.g.down(x, y); });
  cv.addEventListener('pointermove', e => { if (!MINI || MINI.fin) return; const [x, y] = pt(e); if (MINI.g.move) MINI.g.move(x, y); });
  const up = e => { if (!MINI) return; const [x, y] = pt(e); if (MINI.g.up) MINI.g.up(x, y); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('mini-x').onclick = () => closeMini(true);
}
