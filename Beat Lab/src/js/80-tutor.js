// ===== Tutorials (2026-11-16): the coach-mark engine, the lessons, the Learn hub, the "?" panel helper, first-time offers =====
// Tutor engine (other games' tutorials should match its look and feel):
//   Tutor.define({ id, title, blurb, mode, setup() -> a fresh project, steps: [step], end: 'finale text', next: lessonId })
//   step: { title, text (html), el: selector | Element | () => Element | rect | null (what to spotlight), enter() (on arrival),
//           base() -> snapshot taken on arrival, wait(base) -> true once the player has done it (polled every 150 ms against
//           the app state A), at: 'br'|'bl'|'tr'|'tl' (bubble corner when it cannot sit beside the target), free (no click shield) }
//   Tutor.start(id) / stop() / next() / back() / keep(); Tutor.active; Tutor.done(id). Finished lessons: A.set.tut (beatlab_set, synced).
// A lesson runs in a temporary project (its id is in A.temp): Store.save skips it, so it never becomes a song unless the player keeps it
// (Save, or "Keep this song" at the end). Skip, Esc or leaving puts the player's own song back, undo history and all.
const LESSONS = [];
const TT = { les: null, i: 0, base: null, doneAt: 0, prev: null, kept: false, keptId: null, iv: 0, sig: '', el: null, nudgeT: 0 };
const Tutor = {
  get active() { return !!TT.les; },
  define(l) { LESSONS.push(l); },
  done(id) { return !!(A.set.tut && A.set.tut[id]); },
  start: id => tutStart(id), stop: how => tutStop(how || 'skip'), next: () => tutGo(TT.i + 1), back: () => tutGo(TT.i - 1), keep: () => tutKeep()
};
const isTemp = () => !!(A.p && A.temp.has(A.p.id));
// a project made from the tutorial's project (Open in Studio) stays temporary (or kept) like it
function tutFollow(p) {
  if (isTemp()) A.temp.add(p.id);
  else if (TT.les && TT.kept && A.p && A.p.id === TT.keptId) TT.keptId = p.id;
}

function tutStart(id) {
  const les = LESSONS.find(l => l.id === id); if (!les) return false;
  closeModal(); closeMenu(); hideOffer(); setExplain(false);
  if (TT.les) { clearInterval(TT.iv); TT.les = null; }
  if (!TT.prev) {                                           // the player's own song, put back when the lessons end
    if (A.p && !isTemp()) saveIfChanged();
    TT.prev = { id: A.p && !isTemp() ? A.p.id : null, tab: A.ui.tab, playMode: A.ui.playMode, undo: Hist.undo.slice(), redo: Hist.redo.slice() };
  }
  const p = openProject(les.setup()); p.id = uid(); p.name = 'Practice: ' + les.title;
  TT.les = les; TT.kept = false; TT.keptId = null;
  A.temp.add(p.id);
  openProjectObj(p);
  if (A.p.mode === 'studio') { A.ui.playMode = 'pat'; refreshStudio(); }
  tutOverlay();
  tutGo(0);
  TT.iv = setInterval(tutTick, 150);
  return true;
}
function tutStop(how) {                                      // how: skip | back | keep | left
  if (!TT.les) return;
  clearInterval(TT.iv); TT.les = null;
  if (TT.el) { TT.el.root.remove(); TT.el = null; }
  if (how !== 'left' && isTemp()) tutBackToPrev();
  else if (how === 'skip' && TT.kept) toast('Lesson closed. Your practice song is saved as "' + A.p.name + '".', 3000);
  TT.prev = null; TT.kept = false;
}
function tutBackToPrev() {
  const pv = TT.prev;
  let p = pv && pv.id ? Store.load(pv.id) : null;
  if (!p) { const l = Store.list(); if (l.length) p = Store.load(l[0].id); }
  const fresh = !p;
  if (fresh) p = newSimpleProject('My first song');
  if (A.playing) stopPlay();
  openProjectObj(p, true);
  if (fresh) Store.save(A.p);
  Hist.undo.length = 0; Hist.redo.length = 0;
  if (pv) { Hist.undo.push(...pv.undo); Hist.redo.push(...pv.redo); if (A.p.mode === 'studio' && pv.tab) showTab(pv.tab); if (A.p.mode === 'studio' && pv.playMode) setPlayMode(pv.playMode); }
  toast('Back to "' + A.p.name + '"', 1800);
}
// keep the practice song as one of the player's songs (they asked: Save, or "Keep this song")
function tutKeep() {
  if (!isTemp()) return false;
  A.p.id = uid(); if (/^Practice: /.test(A.p.name)) A.p.name = A.p.name.slice(10) + ' (my version)';
  TT.kept = true; TT.keptId = A.p.id;
  Store.save(A.p); A.set.last = A.p.id; Store.saveSet(); refreshAppBar();
  toast('Saved "' + A.p.name + '" as one of your songs', 2600);
  return true;
}
function saveClick() { if (isTemp()) return tutKeep(); if (saveNow()) toast('Saved'); }

// ---- the overlay: a hole that dims everything else, four click shields around it, the speech bubble
function tutOverlay() {
  if (TT.el) TT.el.root.remove();
  const shield = () => h('div', { class: 'tut-shield', onpointerdown: e => { e.preventDefault(); tutNudge(); } });
  const sh = [shield(), shield(), shield(), shield()];
  const hole = h('div', { class: 'tut-hole' });
  const lesson = h('span', { class: 'tut-les' }), prog = h('span', { class: 'tut-prog' }), title = h('h4'), text = h('p'), task = h('div', { class: 'tut-task' });
  const skip = h('button', { class: 'tut-skip', title: 'Leave the lesson (Esc)', onclick: () => tutStop(TT.i >= TT.les.steps.length ? 'back' : 'skip') }, 'Skip lesson');
  const back = h('button', { class: 'btn small', onclick: () => tutGo(TT.i - 1) }, 'Back');
  const next = h('button', { class: 'btn small primary', onclick: () => tutGo(TT.i + 1) }, 'Next');
  const extra = h('div', { class: 'tut-end' });
  const bub = h('div', { class: 'tut-bubble', role: 'dialog', 'aria-live': 'polite' },
    h('div', { class: 'tut-top' }, lesson, prog), title, text, task, extra, h('div', { class: 'tut-btns' }, skip, h('span', { class: 'sp' }), back, next));
  const root = h('div', { id: 'tut' }, sh, hole, bub);
  document.body.appendChild(root);
  TT.el = { root, sh, hole, bub, lesson, prog, title, text, task, skip, back, next, extra };
}
function tutNudge() { const b = TT.el && TT.el.bub; if (!b) return; b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }
function tutGo(i) {
  const les = TT.les; if (!les || !TT.el) return;
  const n = les.steps.length;
  if (i < 0) i = 0;
  if (i > n) return tutStop('back');
  TT.i = i; TT.doneAt = 0; TT.sig = '';
  const E2 = TT.el; E2.extra.innerHTML = '';
  E2.lesson.textContent = les.title;
  if (i === n) {                                              // the finale: the lesson counts as done
    A.set.tut = A.set.tut || {}; A.set.tut[les.id] = 1; Store.saveSet();
    const nx = les.next && LESSONS.find(l => l.id === les.next);
    E2.prog.textContent = 'Done!'; E2.title.textContent = 'Lesson complete'; E2.text.innerHTML = les.end || 'Nice work!';
    E2.task.className = 'tut-task hidden';
    if (isTemp()) E2.extra.append(h('button', { class: 'btn small', onclick: () => { tutKeep(); tutStop('keep'); } }, 'Keep this song'));
    E2.extra.append(h('button', { class: 'btn small', onclick: () => { tutStop('back'); setTimeout(learnHub, 30); } }, 'All lessons'));
    if (nx) E2.extra.append(h('button', { class: 'btn small primary', onclick: () => tutStart(nx.id) }, 'Next: ' + nx.title));
    E2.skip.textContent = TT.kept ? 'Close' : 'Back to my song';
    E2.next.classList.add('hidden'); E2.back.classList.remove('hidden');
    tutPlace(true);
    return;
  }
  const st = les.steps[i];
  try { if (st.enter) st.enter(); } catch (e) { reportErr(e); }
  TT.base = null; try { if (st.base) TT.base = st.base(); } catch (e) { reportErr(e); }
  E2.prog.textContent = (i + 1) + ' of ' + n;
  E2.title.textContent = st.title || '';
  E2.text.innerHTML = st.text || '';
  E2.skip.textContent = 'Skip lesson';
  E2.back.classList.toggle('hidden', i === 0); E2.next.classList.remove('hidden');
  let pre = false;
  if (st.wait) { try { pre = !!st.wait(TT.base); } catch (e) {} }
  if (st.wait && pre) TT.doneAt = -1;                        // already done (e.g. coming Back): no auto-advance, just Next
  tutTaskUi(st, pre);
  tutPlace(true);
  if (!st.wait) try { TT.el.next.focus({ preventScroll: true }); } catch (e) {}
}
function tutTaskUi(st, done) {
  const E2 = TT.el, last = TT.i === TT.les.steps.length - 1;
  if (!st.wait) { E2.task.className = 'tut-task hidden'; E2.next.textContent = last ? 'Finish' : 'Next'; E2.next.className = 'btn small primary'; return; }
  E2.task.className = 'tut-task' + (done ? ' ok' : '');
  E2.task.textContent = done ? '✓ Nice!' : 'Your turn: do it and the lesson moves on';
  E2.next.textContent = done ? (last ? 'Finish' : 'Next') : 'Skip step';
  E2.next.className = 'btn small' + (done ? ' primary' : ' ghost');
}
function tutTick() {
  if (!TT.les) return;
  if (TT.kept ? (!A.p || A.p.id !== TT.keptId) : !isTemp()) return tutStop('left');      // the player opened another song
  const st = TT.les.steps[TT.i];
  if (st && st.enter && st.el && !tutTarget(st)) { try { st.enter(); } catch (e) {} }     // e.g. the player switched views with F5-F9
  tutPlace(false);
  tutMakeWay();
  if (!st || !st.wait || TT.doneAt) return;
  let ok = false; try { ok = !!st.wait(TT.base); } catch (e) {}
  if (!ok) return;
  TT.doneAt = performance.now(); tutTaskUi(st, true);
  const at = TT.i;
  setTimeout(() => { if (TT.les && TT.i === at) tutGo(at + 1); }, 800);
}
// a menu or dialog the player opened goes on top: the bubble fades and lets clicks through while they overlap
function tutMakeWay() {
  const b = TT.el.bub, r = b.getBoundingClientRect();
  const hit = ['#ctxmenu', '#modal .mbox'].some(s => { const e = $(s); if (!e) return false; const q = e.getBoundingClientRect(); return q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; });
  if (b.classList.contains('under') !== hit) b.classList.toggle('under', hit);
}
function tutTarget(st) {
  let t = st && st.el;
  try { if (typeof t === 'function') t = t(); } catch (e) { t = null; }
  if (typeof t === 'string') t = $(t);
  if (!t) return null;
  const r = t.getBoundingClientRect ? t.getBoundingClientRect() : t;
  if (!r || !(r.width > 2) || !(r.height > 2)) return null;
  const l = Math.max(0, r.left), tp = Math.max(0, r.top), rt = Math.min(innerWidth, r.left + r.width), bt = Math.min(innerHeight, r.top + r.height);
  return rt - l > 2 && bt - tp > 2 ? { l, t: tp, r: rt, b: bt } : null;
}
const rectOf = (...els) => {                                  // the box around several elements
  let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
  for (const e of els) { if (!e) continue; const q = e.getBoundingClientRect(); if (q.width < 1) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  return r > l ? { left: l, top: t, width: r - l, height: b - t } : null;
};
function tutPlace(force) {
  const E2 = TT.el; if (!E2) return;
  const st = TT.les.steps[TT.i], tg = st ? tutTarget(st) : null, P = 6, W = innerWidth, H = innerHeight;
  const bw = E2.bub.offsetWidth, bh = E2.bub.offsetHeight;
  const sig = (tg ? [tg.l, tg.t, tg.r, tg.b].map(Math.round).join(',') : '-') + '|' + W + 'x' + H + '|' + bw + 'x' + bh + (st && st.free ? 'f' : '');
  if (!force && sig === TT.sig) return;
  TT.sig = sig;
  const box = (el, l, t, w, hh) => { el.style.left = l + 'px'; el.style.top = t + 'px'; el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, hh) + 'px'; };
  const free = !!(st && st.free);
  if (tg) {
    const l = Math.max(0, tg.l - P), t = Math.max(0, tg.t - P), r = Math.min(W, tg.r + P), b = Math.min(H, tg.b + P);
    E2.hole.classList.remove('none'); box(E2.hole, l, t, r - l, b - t);
    box(E2.sh[0], 0, 0, W, t); box(E2.sh[1], 0, b, W, H - b); box(E2.sh[2], 0, t, l, b - t); box(E2.sh[3], r, t, W - r, b - t);
  } else {
    E2.hole.classList.add('none'); box(E2.hole, W / 2, H / 2, 0, 0);
    box(E2.sh[0], 0, 0, W, H); box(E2.sh[1], 0, 0, 0, 0); box(E2.sh[2], 0, 0, 0, 0); box(E2.sh[3], 0, 0, 0, 0);
  }
  E2.root.classList.toggle('free', free);
  // the bubble: beside the target if it fits (below, above, right, left), else in a corner; never off-screen
  const M = 12, fit = (x, y) => x >= 8 && y >= 8 && x + bw <= W - 8 && y + bh <= H - 8;
  let x, y;
  if (!tg) { x = (W - bw) / 2; y = (H - bh) / 2; }
  else {
    const cx = clamp((tg.l + tg.r) / 2 - bw / 2, 8, W - bw - 8), cy = clamp((tg.t + tg.b) / 2 - bh / 2, 8, H - bh - 8);
    const opts = [[cx, tg.b + P + M], [cx, tg.t - P - M - bh], [tg.r + P + M, cy], [tg.l - P - M - bw, cy]];
    const o = opts.find(([a, b]) => fit(a, b));
    if (o) [x, y] = o;
    else { const at = st.at || 'br'; x = at[1] === 'l' ? 16 : W - bw - 16; y = at[0] === 't' ? 56 : H - bh - 40; }
  }
  E2.bub.style.left = Math.round(clamp(x, 8, Math.max(8, W - bw - 8))) + 'px';
  E2.bub.style.top = Math.round(clamp(y, 8, Math.max(8, H - bh - 8))) + 'px';
}
addEventListener('resize', () => { if (TT.les) tutPlace(true); });
document.addEventListener('scroll', () => { if (TT.les) tutPlace(false); }, true);
// Esc always leaves the lesson (after closing a dialog or menu that is open on top)
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('#tut-tip.show')) hideTip();
  if (!TT.les || $('#modal') || $('#ctxmenu')) return;
  e.preventDefault(); e.stopPropagation();
  tutStop(TT.i >= TT.les.steps.length ? 'back' : 'skip');
}, true);

// ---- first-time offers (once each: the answer, or just seeing it, is remembered in the settings)
function offer(kind) {
  hideOffer();
  const st = kind === 'studio';
  const card = h('div', { id: 'tut-offer', class: 'tut-bubble offer' },
    h('div', { class: 'tut-top' }, h('span', { class: 'tut-les' }, st ? 'Studio' : 'Welcome'), h('span', { class: 'tut-prog' }, st ? '2 minutes' : '1 minute')),
    h('h4', null, st ? 'Take the 2-minute tour?' : 'New here? Learn Simple mode in 1 minute?'),
    h('p', null, st ? 'Make your first beat step by step and find out what every panel does. It uses a practice song.' : 'Paint a tune, add drums, change the sound and play it: you do each step yourself.'),
    h('div', { class: 'tut-btns' }, h('button', { class: 'btn small', onclick: () => hideOffer() }, st ? 'No thanks, I know studios' : 'No thanks'), h('span', { class: 'sp' }),
      h('button', { class: 'btn small primary', onclick: () => { hideOffer(); tutStart(st ? 'studio1' : 'simple1'); } }, 'Yes')));
  document.body.appendChild(card);
}
function hideOffer() { const o = $('#tut-offer'); if (o) o.remove(); }

// ---- the Learn hub
function learnHub() {
  const done = LESSONS.filter(l => Tutor.done(l.id)).length;
  const rows = h('div', { class: 'lrows' }, LESSONS.map((l, i) => {
    const d = Tutor.done(l.id);
    return h('div', { class: 'lrow' + (d ? ' done' : ''), 'data-l': l.id },
      h('span', { class: 'ltick', title: d ? 'Done' : '' }, d ? '✓' : String(i + 1)),
      h('div', { class: 'lmeta' }, h('b', null, l.title), h('span', { class: 'hint' }, l.blurb + ' · ' + l.steps.length + ' steps')),
      h('button', { class: 'btn small' + (d ? '' : ' primary'), onclick: () => tutStart(l.id) }, d ? 'Again' : 'Start'));
  }));
  modal('Learn Beat Lab', h('div', { class: 'learn' },
    h('p', null, 'Short lessons where you do each step yourself. They use a practice song, so your own songs stay exactly as they are. Esc or "Skip lesson" leaves at any time.'),
    rows,
    h('p', { class: 'hint' }, done + ' of ' + LESSONS.length + ' done. In the Studio, press ', h('b', null, '?'), ' (top right) and point at any panel to see what it is.')),
    [{ t: 'Close' }], { wide: true });
  A.ui.dlg = 'learn';
}

// ---- "?" helper: point at (or long-press) any Studio panel for a one-line explanation
const HELP_TIPS = [
  [() => ST.play && ST.play.parentNode, 'Transport: play and stop, record, tempo and the pattern you are working on'],
  [() => ST.modeBtn, 'Pattern plays just the loop you are editing; Song plays the whole Playlist'],
  [() => ST.play, 'Play / stop (Space)'],
  [() => ST.rec, 'Record: play notes on your computer keyboard (or MIDI) and they are written into the pattern'],
  [() => ST.tempo, 'Tempo: how fast the song goes, in beats per minute (drag it, or click to type)'],
  [() => ST.swing, 'Swing: pushes every other step a little late for a bouncy, shuffled feel'],
  [() => ST.patSel && ST.patSel.parentNode, 'Pattern: the loop you are editing. + makes a new one; ⋯ renames, clones or resizes it'],
  [() => $('#browser'), 'Sound browser: every instrument and drum sound. Click to listen, + adds it as a new channel'],
  [() => ST.tabs, 'Views: Playlist, Channel rack, Piano roll, Instrument and Mixer (F5 to F9)'],
  [() => $('#pane-rack'), 'Channel rack: every instrument in your song, with a step grid for beats'],
  [() => RK.heads, 'Channels: mute light, pan, volume, mixer track number and name (double-click a name for its sound)'],
  [() => $('#pane-roll'), 'Piano roll: draw notes for one instrument. Higher rows are higher notes; longer bars play longer'],
  [() => RL.root && RL.root.firstChild, 'Piano roll tools: draw, paint, select, erase or stamp chords, plus snap, scale and note style'],
  [() => $('#pane-playlist'), 'Playlist: put your patterns in order along the timeline to build the whole song'],
  [() => PL.ruler, 'Ruler: click to play from there, drag to loop just that part'],
  [() => $('#pane-synth'), 'Instrument: shape the selected channel\'s sound with knobs (oscillators, filter, envelope)'],
  [() => $('#pane-mixer'), 'Mixer: each track\'s volume, pan and effects. Every track ends up in Master'],
  [() => MX.editor, 'Effects: the effects on the selected mixer track; turn their knobs to change the sound'],
  [() => A.appbar && A.appbar.learn, 'Learn: short hands-on lessons, with ticks for the ones you finished']
];
const HX = { on: false, cur: null, lpT: 0, hideT: 0 };
function setExplain(on) {
  HX.on = !!on;
  document.body.classList.toggle('explain', HX.on);
  if (A.appbar && A.appbar.q) A.appbar.q.classList.toggle('on', HX.on);
  if (HX.on) { for (const [get, txt] of HELP_TIPS) { const el = get(); if (el && el.setAttribute) el.setAttribute('data-help', txt); } toast('Point at any part of the Studio to see what it is. Press ? again to stop.', 2600); }
  else hideTip();
}
function showTip(el, x, y) {
  let tip = $('#tut-tip');
  if (!tip) { tip = h('div', { id: 'tut-tip' }); document.body.appendChild(tip); }
  if (HX.cur !== el) { if (HX.cur) HX.cur.classList.remove('help-on'); HX.cur = el; el.classList.add('help-on'); tip.textContent = el.getAttribute('data-help'); }
  tip.classList.add('show');
  const w = tip.offsetWidth, hh = tip.offsetHeight;
  tip.style.left = Math.round(clamp(x + 14, 6, innerWidth - w - 6)) + 'px';
  tip.style.top = Math.round(y + 18 + hh > innerHeight - 6 ? y - hh - 12 : y + 18) + 'px';
}
function hideTip() { const tip = $('#tut-tip'); if (tip) tip.classList.remove('show'); if (HX.cur) HX.cur.classList.remove('help-on'); HX.cur = null; }
document.addEventListener('pointermove', e => {
  if (!HX.on || e.pointerType === 'touch') return;
  const el = e.target && e.target.closest && e.target.closest('[data-help]');
  if (el && document.body.dataset.mode === 'studio') showTip(el, e.clientX, e.clientY); else hideTip();
}, { passive: true });
document.addEventListener('pointerdown', e => {
  if (!HX.on || e.pointerType !== 'touch') return;
  clearTimeout(HX.lpT); clearTimeout(HX.hideT);
  const x = e.clientX, y = e.clientY, el = e.target && e.target.closest && e.target.closest('[data-help]');
  if (!el) return;
  HX.lpT = setTimeout(() => { showTip(el, x, y); HX.hideT = setTimeout(hideTip, 3000); }, 450);
}, { passive: true });
const lpCancel = () => clearTimeout(HX.lpT);
document.addEventListener('pointerup', lpCancel, { passive: true });
document.addEventListener('pointercancel', lpCancel, { passive: true });

// ---- lesson helpers: practice songs, state checks, targets
const tch = n => A.p.ch.find(c => c.n === n);
const tSteps = n => { const c = tch(n), q = curPat(); return c ? (q.st[c.id] || []).filter(v => v > 0).length : 0; };
const tNotes = () => { const c = curCh(); return c ? (curPat().nt[c.id] || []) : []; };
const tab = id => () => { if (A.ui.tab !== id) showTab(id); };
const tabBtn = id => () => $('.tabs button[data-t="' + id + '"]');
const inTab = (id, f) => () => A.ui.tab === id ? f() : null;
const appBtn = k => () => A.appbar && A.appbar[k];
function rackRow(n) {
  return inTab('rack', () => {
    const c = tch(n); if (!c || !RK.cv) return null;
    const i = A.p.ch.indexOf(c), cv = RK.cv.getBoundingClientRect(), hd = RK.heads.getBoundingClientRect(), bd = RK.body.getBoundingClientRect();
    const top = cv.top + i * ROWH, right = Math.min(cv.left + curPat().len * RK.cw + 2, bd.right);
    return { left: hd.left, top, width: right - hd.left, height: ROWH };
  });
}
const simpleArea = drums => () => {
  if (A.p.mode !== 'simple' || !SV.wrap) return null;
  const r = SV.wrap.getBoundingClientRect(), G = simpleGeom(), split = G.H - G.drumH + 4;
  return drums ? { left: r.left, top: r.top + split, width: r.width, height: G.H - split } : { left: r.left, top: r.top, width: r.width, height: split - 2 };
};
const strip = (k, f) => inTab('mixer', () => { const s = MX.strips[typeof k === 'function' ? k() : k]; return s ? f(s) : null; });
const keysTrack = () => (tch('Keys') || {}).mix || 5;
function setSteps(p, q, n, idx) { const c = p.ch.find(x => x.n === n); if (!c) return; q.st[c.id] = new Array(q.len).fill(0); idx.forEach(i => { q.st[c.id][i] = 100; }); }
function practiceSong(withKeys, arranged) {
  const p = newStudioProject('Practice'); p.bpm = 96; p.key = 0; p.scale = 'minor';
  const beat = q => { setSteps(p, q, 'Kick', [0, 7, 8, 10]); setSteps(p, q, 'Snare', [4, 12]); setSteps(p, q, 'Hat', [0, 2, 4, 6, 8, 10, 12, 14]); setSteps(p, q, 'Clap', [12]); };
  const q1 = p.pat[0]; q1.n = 'Beat'; beat(q1);
  p.pl.cl = [];
  if (withKeys) {
    const q2 = { id: 2, n: 'Beat + keys', len: 16, st: {}, nt: {}, col: CH_COLS[10] }; beat(q2);
    const keys = p.ch.find(x => x.n === 'Keys'), bass = p.ch.find(x => x.n === '808');
    q2.nt[keys.id] = [[0, 90, 60, 96], [0, 90, 63, 90], [0, 90, 67, 90], [96, 90, 56, 96], [96, 90, 60, 90], [96, 90, 63, 90]];
    q2.nt[bass.id] = [[0, 84, 36, 110], [96, 84, 32, 110]];
    p.pat.push(q2);
    if (arranged) p.pl.cl = [[1, 0, 0, 16], [2, 0, 16, 16], [2, 0, 32, 16], [1, 0, 48, 16]];
  }
  return p;
}
// screen point of a cell, for tests (the debug hook): simple|drum|rack|roll|vel|pl|ruler
function tutXY(kind, a, b) {
  if (kind === 'simple' || kind === 'drum') {
    const r = SV.cv.getBoundingClientRect(), G = simpleGeom();
    return { x: r.left + (a + 0.5) * G.cw, y: kind === 'simple' ? r.top + (G.rows - 1 - b + 0.5) * G.rh : r.top + G.top + (b + 0.5) * G.laneH };
  }
  if (kind === 'rack') { const r = RK.cv.getBoundingClientRect(); return { x: r.left + 1 + (b + 0.5) * RK.cw, y: r.top + (a + 0.5) * ROWH }; }
  if (kind === 'roll') { const r = RL.cv.getBoundingClientRect(); return { x: r.left + tx(a) + 3, y: r.top + ny(b) + RL.rowH / 2 }; }
  if (kind === 'vel') { const r = RL.cv.getBoundingClientRect(); return { x: r.left + tx(a) + 1, y: r.top + r.height - VELH + 8 + (1 - b / 127) * (VELH - 12) }; }
  if (kind === 'pl') { const r = PL.cv.getBoundingClientRect(); return { x: r.left + a * PL.pps - PL.sx + 4, y: r.top + (b + 0.5) * TRH }; }
  if (kind === 'ruler') { const r = PL.ruler.getBoundingClientRect(); return { x: r.left + a * PL.pps - PL.sx, y: r.top + r.height / 2 }; }
  return null;
}

// ---- the lessons
Tutor.define({
  id: 'simple1', title: 'Simple mode in 1 minute', blurb: 'Paint a tune, add drums and layers, play it', mode: 'simple', next: 'studio1',
  setup: () => { const p = newSimpleProject('Practice'); p.simple.scale = 'pentatonic'; p.simple.bpm = 104; return p; },
  end: 'That is Simple mode! Every note you paint is in the scale, so it always sounds good. <b>Studio 1</b> shows what all the Studio panels do.',
  steps: [
    { title: 'This is your song', text: 'Each square is a note. Time goes from left to right, and <b>higher rows are higher notes</b>.', el: simpleArea(false) },
    { title: 'Paint a tune', text: 'Click squares (or drag across them) in the top part. Paint <b>at least 6 notes</b>.', el: simpleArea(false), wait: () => A.p.simple.ly[0].mel.length >= 6 },
    { title: 'Add drums', text: 'The bottom rows are drums: kick, snare, hats and more. Add <b>at least 4 drum hits</b>.', el: simpleArea(true), wait: () => A.p.simple.drm.length >= 4 },
    { title: 'Change the instrument', text: 'Pick a <b>different instrument</b> for your tune.', el: '.s-insts', base: () => A.p.simple.ly[0].inst, wait: b => A.p.simple.ly[0].inst !== b },
    { title: 'Add a layer', text: 'A layer is a second instrument playing its own notes on top. Press <b>+ Layer</b>.', el: '.s-addl', wait: () => A.p.simple.ly.length >= 2 },
    { title: 'Paint the new layer', text: 'Paint <b>3 or more notes</b> for the new layer. The first layer shows faintly so you can fit around it.', el: simpleArea(false), wait: () => A.p.simple.ly.length >= 2 && A.p.simple.ly[A.p.simple.ly.length - 1].mel.length >= 3 },
    { title: 'The articulation brush', text: 'Brushes change <b>how</b> notes play. Pick <b>Accent</b> or <b>Staccato</b>, then click one of your notes.', el: '.s-brush', free: true, wait: () => A.p.simple.ly.some(L => L.mel.some(n => n[2])) || A.p.simple.drm.some(n => n[2]) },
    { title: 'Play it', text: 'Press <b>Play</b> (or the Space bar) to hear your song.', el: '#s-play', wait: () => A.playing },
    { title: 'Open in Studio', text: 'Want more control? <b>Open in Studio</b> turns this song into a full studio project, every layer its own instrument. Try it!', el: () => $$('#simple .s-bottom .btn.primary')[0], wait: () => A.p.mode === 'studio' }
  ]
});
Tutor.define({
  id: 'studio1', title: 'Studio 1: your first beat', blurb: 'The channel rack, steps, play, tempo and patterns', mode: 'studio', next: 'studio2',
  setup: () => { const p = newStudioProject('Practice'); p.bpm = 100; p.pl.cl = [[1, 0, 0, 16]]; return p; },
  end: 'You made a beat! Kick, snare and hats on steps is how most songs start. <b>Studio 2</b> adds a melody.',
  steps: [
    { title: 'The channel rack', text: 'Every instrument in your song is one row here, called a <b>channel</b>. The squares are <b>steps</b>: 16 steps make one bar.', el: inTab('rack', () => $('#pane-rack')), enter: tab('rack'), at: 'bl' },
    { title: 'Kick drum', text: 'Click <b>4 steps</b> in the <b>Kick</b> row. Try steps 1, 5, 9 and 13 (the first of each group of four).', el: rackRow('Kick'), enter: tab('rack'), wait: () => tSteps('Kick') >= 4 },
    { title: 'Snare', text: 'Now click <b>steps 5 and 13</b> in the <b>Snare</b> row.', el: rackRow('Snare'), enter: tab('rack'), wait: () => tSteps('Snare') >= 2 },
    { title: 'Hi-hats', text: 'Hats keep time. Click <b>at least 6 steps</b> in the <b>Hat</b> row: every other step sounds great.', el: rackRow('Hat'), enter: tab('rack'), wait: () => tSteps('Hat') >= 6 },
    { title: 'Play', text: 'Press <b>Play</b> (or the Space bar) to hear your beat loop.', el: () => ST.play, wait: () => A.playing },
    { title: 'Tempo', text: 'This is the <b>tempo</b> in beats per minute (BPM). <b>Drag it up or down</b> to change the speed (or click it and type a number).', el: () => ST.tempo, base: () => A.p.bpm, wait: b => A.p.bpm !== b },
    { title: 'Stop', text: 'Press <b>Stop</b> (or the Space bar again).', el: () => $('.st-bar .tbtn.stop'), wait: () => !A.playing },
    { title: 'Patterns', text: 'A <b>pattern</b> is one loop of beats and notes. Songs use several. Press <b>+</b> to make a new, empty pattern.', el: () => ST.patSel && ST.patSel.parentNode, base: () => A.p.pat.length, wait: b => A.p.pat.length > b },
    { title: 'Switch patterns', text: 'Your new pattern is empty. Pick <b>Pattern 1</b> in this menu: your beat is still there.', el: () => ST.patSel && ST.patSel.parentNode, wait: () => A.ui.pat === A.p.pat[0].id && A.p.pat.length > 1 }
  ]
});
Tutor.define({
  id: 'studio2', title: 'Studio 2: write a melody', blurb: 'Add an instrument, the piano roll, chords and styles', mode: 'studio', next: 'studio3',
  setup: () => practiceSong(false),
  end: 'That is a melody on top of a beat. The piano roll is where most of a song gets written. <b>Studio 3</b> turns loops into a whole song.',
  steps: [
    { title: 'The sound browser', text: 'Every instrument Beat Lab has is here. <b>Click a sound</b> to hear it.', el: '#browser' },
    { title: 'Add an instrument', text: 'Pick a sound you like (Keys is open; try Leads or Plucks too) and press the <b>+</b> that appears next to it to add it as a new channel.', el: '#browser', base: () => A.p.ch.length, wait: b => A.p.ch.length > b },
    { title: 'Open the piano roll', text: 'Your new channel is selected. Open the <b>Piano roll</b> tab.', el: tabBtn('roll'), wait: () => A.ui.tab === 'roll' },
    { title: 'Draw notes', text: '<b>Click in the grid</b> to draw notes: higher rows are higher notes. Draw <b>at least 4</b>.', el: inTab('roll', () => RL.box), enter: tab('roll'), base: () => tNotes().length, wait: b => tNotes().length >= b + 4, at: 'tr' },
    { title: 'Make a note longer', text: 'Drag the <b>right end</b> of a note to the right to make it last longer.', el: inTab('roll', () => RL.box), enter: tab('roll'), base: () => Math.max(0, ...tNotes().map(n => n[1])), wait: b => tNotes().some(n => n[1] > b), at: 'tr' },
    { title: 'Velocity', text: 'The bars along the bottom are <b>velocity</b>: how hard each note plays. <b>Drag a bar down</b> to make that note softer.', el: inTab('roll', () => { const r = RL.box.getBoundingClientRect(); return { left: r.left, top: r.bottom - VELH, width: r.width, height: VELH }; }), enter: tab('roll'), base: () => tNotes().filter(n => (n[3] || 100) !== 100).length, wait: b => tNotes().filter(n => (n[3] || 100) !== 100).length > b },
    { title: 'Scale highlighting', text: 'Rows <b>outside the scale</b> are shaded, so you can stay in key. Pick a different <b>scale</b> (or key) to see it change.', el: inTab('roll', () => rectOf(RL.key, RL.scale)), enter: tab('roll'), base: () => A.p.key + A.p.scale, wait: b => A.p.key + A.p.scale !== b },
    { title: 'The chord stamp', text: 'Press <b>Chord</b>, then click the grid to stamp a whole chord in one go.', el: inTab('roll', () => rectOf($('button[data-t="chord"]', RL.toolBtns), $('select[title="Chord to stamp"]', RL.root))), enter: tab('roll'), base: () => tNotes().length, wait: b => tNotes().length >= b + 3, free: true },
    { title: 'Articulations', text: '<b>Style</b> changes how notes play. Pick <b>Staccato</b> or <b>Vibrato</b>, then draw a new note (or select notes first to change them).', el: inTab('roll', () => RL.artSel), enter: tab('roll'), base: () => tNotes().filter(n => n[4]).length, wait: b => tNotes().filter(n => n[4]).length > b, free: true },
    { title: 'Hear it', text: 'Press the <b>Space bar</b> to hear your melody with the beat.', el: () => ST.play, wait: () => A.playing }
  ]
});
Tutor.define({
  id: 'studio3', title: 'Studio 3: arrange a song', blurb: 'Patterns and the playlist, clips, Song mode, loops', mode: 'studio', next: 'studio4',
  setup: () => practiceSong(true, false),
  end: 'You arranged a song! Patterns are the pieces, the Playlist puts them in order. <b>Studio 4</b> mixes it.',
  steps: [
    { title: 'Patterns are the pieces', text: 'This song has two patterns (loops): <b>Beat</b> and <b>Beat + keys</b>. The <b>Playlist</b> puts patterns in order to make a whole song.', el: () => ST.patSel && ST.patSel.parentNode },
    { title: 'Open the Playlist', text: 'Open the <b>Playlist</b> tab.', el: tabBtn('playlist'), wait: () => A.ui.tab === 'playlist' },
    { title: 'Place a clip', text: 'Under <b>Place</b>, pick <b>Beat</b>, then <b>click at the start of Track 1</b> to place it. A pattern on the playlist is called a <b>clip</b>.', el: inTab('playlist', () => $('#pane-playlist')), enter: tab('playlist'), wait: () => A.p.pl.cl.some(c => c[0] === 1), at: 'br' },
    { title: 'Place the next part', text: 'Now pick <b>Beat + keys</b> under Place and click just <b>after</b> the first clip.', el: inTab('playlist', () => $('#pane-playlist')), enter: tab('playlist'), wait: () => A.p.pl.cl.some(c => c[0] === 2), at: 'br' },
    { title: 'Move a clip', text: '<b>Drag a clip</b> to move it to another spot or track.', el: inTab('playlist', () => $('.pl-grid')), enter: tab('playlist'), base: () => A.p.pl.cl.map(c => [c, c[1], c[2]]), wait: b => b.some(([c, tr, s]) => A.p.pl.cl.includes(c) && (c[1] !== tr || c[2] !== s)), at: 'br' },
    { title: 'Copy a clip', text: 'Hold <b>Shift</b> and drag a clip to copy it (or select it and press <b>Ctrl+D</b>).', el: inTab('playlist', () => $('.pl-grid')), enter: tab('playlist'), base: () => A.p.pl.cl.length, wait: b => A.p.pl.cl.length > b, at: 'br' },
    { title: 'Song or Pattern', text: '<b>Pattern</b> plays just the loop you are editing; <b>Song</b> plays the whole playlist. Click <b>Song</b>.', el: () => ST.modeBtn, wait: () => A.ui.playMode === 'song' },
    { title: 'Play the song', text: 'Press <b>Play</b> (or Space) to hear your arrangement.', el: () => ST.play, wait: () => A.playing },
    { title: 'Loop a part', text: '<b>Drag across the ruler</b> above the clips to loop just that part. Great for working on one section.', el: inTab('playlist', () => PL.ruler), enter: tab('playlist'), wait: () => !!A.p.loop }
  ]
});
Tutor.define({
  id: 'studio4', title: 'Studio 4: mix it', blurb: 'Mixer tracks, volume, pan, effects and the limiter', mode: 'studio', next: 'studio5',
  setup: () => practiceSong(true, true),
  end: 'That is mixing: balance the volumes, spread sounds left and right, add some space with effects. <b>Studio 5</b> saves and shares your song.',
  steps: [
    { title: 'Open the Mixer', text: 'Open the <b>Mixer</b> tab.', el: tabBtn('mixer'), wait: () => A.ui.tab === 'mixer' },
    { title: 'Mixer tracks', text: 'Each strip is a <b>mixer track</b>. Every channel plays into one: Kick into track 1, Keys into track 5 (it is the number next to each name in the Channel rack).', el: inTab('mixer', () => MX.stripsEl), enter: tab('mixer'), at: 'tr' },
    { title: 'Routing', text: '<b>Out</b> says where a track goes next. Normally that is <b>Master</b> (on the left), where every track ends up.', el: strip(keysTrack, s => s.el), enter: tab('mixer') },
    { title: 'Play while you mix', text: 'Press the <b>Space bar</b> so you can hear your changes.', el: () => ST.play, wait: () => A.playing },
    { title: 'Volume', text: 'Drag the <b>Keys fader</b> down a little to make the keys quieter.', el: strip(keysTrack, s => s.fader), enter: tab('mixer'), base: () => A.p.mix[keysTrack()].vol, wait: b => A.p.mix[keysTrack()].vol !== b },
    { title: 'Pan', text: 'Turn the <b>Pan</b> knob (drag up or down) to move the keys to the left or right speaker.', el: strip(keysTrack, s => s.pan), enter: tab('mixer'), base: () => A.p.mix[keysTrack()].pan, wait: b => A.p.mix[keysTrack()].pan !== b },
    { title: 'Add an effect', text: 'Click <b>+ effect</b> on the Keys track and pick <b>Reverb</b> (or Delay).', el: strip(keysTrack, s => $('.slot.add', s.el)), enter: tab('mixer'), wait: () => A.p.mix[keysTrack()].fx.some(f => f.t === 'reverb' || f.t === 'delay') },
    { title: 'Tweak it', text: 'Turn one of the effect\'s <b>knobs</b> (try <b>Mix</b>) to hear more or less of it.', el: inTab('mixer', () => MX.editor), enter: tab('mixer'), at: 'tl',
      wait: () => A.p.mix[keysTrack()].fx.some(f => (f.t === 'reverb' || f.t === 'delay') && Object.entries(E.fxDefaults(f.t)).some(([k, v]) => f.p[k] !== v)) },
    { title: 'The master limiter', text: 'The Master has a <b>limiter</b>: it stops the whole song from getting so loud that it crackles. Leave it on.', el: strip(0, s => $('.tog', s.el)), enter: tab('mixer') }
  ]
});
Tutor.define({
  id: 'studio5', title: 'Studio 5: finish and share', blurb: 'Save, download as audio, share codes, launcher music', mode: 'studio',
  setup: () => practiceSong(true, true),
  end: 'You know the whole Studio now! <b>Your song could be in a game:</b> great songs may be picked to play in one of our games, so share yours in <b>#music</b>.',
  steps: [
    { title: 'Name your song', text: 'Click the song\'s <b>name</b> up here and give it a name of your own.', el: appBtn('name'), base: () => A.p.name, wait: b => A.p.name !== b },
    { title: 'Save', text: 'Beat Lab saves your songs as you go. This one is a practice song, so press <b>Save</b> to keep it as one of yours (or Skip step to leave it).', el: appBtn('save'), wait: () => TT.kept },
    { title: 'Download', text: '<b>Download</b> turns your song into a sound file (WAV) you can play anywhere or put in a video. Press it to see the choices.', el: appBtn('dl'), wait: () => A.ui.dlg === 'download' },
    { title: 'Download choices', text: '<b>Song as audio</b> saves the whole song; you can also save just the drums or the melody. Pick one, or <b>Close</b> for now.', el: '#modal .mbox', free: true, wait: () => A.ui.dlg !== 'download' },
    { title: 'Share', text: '<b>Share</b> gives your song a 6-digit code. Friends type it into Beat Lab to hear it and make their own copy. Press Share.', el: appBtn('share'), wait: () => A.ui.dlg === 'share' },
    { title: 'Post it in #music', text: 'Tick <b>Post it in #music</b> so everyone can hear it, then <b>Get a code</b>. Close the box when you are done.', el: '#modal .mbox', free: true, wait: () => A.ui.dlg !== 'share' },
    { title: 'Launcher music', text: '<b>♪ Launcher music</b> plays your song on the launcher\'s pages (never over a game), instead of the shop track.', el: () => $('.st-bar .lmbtn') },
    { title: 'Your song could be in a game!', text: '<b>Great songs may be picked to play in one of our games.</b> Finish yours, share it in <b>#music</b>, and keep an ear out.', el: null }
  ]
});
