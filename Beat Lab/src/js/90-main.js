// ===== app bar, modes, boot, background warm-up, debug hook (window.__beatlab) =====
function buildAppBar() {
  const bar = $('#appbar'); bar.innerHTML = '';
  const name = h('button', { class: 'pname', title: 'Rename this project', onclick: () => ask('Rename project', A.p.name, v => { A.p.name = v; saveNow(); refreshAppBar(); }) });
  let save, share, dl;
  const learn = h('button', { class: 'btn small learn', title: 'Short hands-on lessons: Simple mode and every part of the Studio', onclick: learnHub }, 'Learn');
  const q = h('button', { class: 'btn small qbtn', title: 'What is this? Turn on, then point at any part of the Studio', onclick: () => setExplain(!HX.on) }, '?');
  const seg = h('div', { class: 'seg mode' }, h('button', { 'data-m': 'simple', title: 'Big, simple song grid', onclick: () => switchMode('simple') }, 'Simple'), h('button', { 'data-m': 'studio', title: 'Full studio: channel rack, piano roll, playlist, mixer', onclick: () => switchMode('studio') }, 'Studio'));
  bar.append(h('div', { class: 'logo' }, h('i', { class: 'lg' }), h('span', null, 'Beat', h('b', null, 'Lab'))), name,
    h('button', { class: 'btn small', title: 'Open, start or import a project, or open a demo', onclick: projectsDialog }, 'Projects'),
    save = h('button', { class: 'btn small', title: 'Save now (Ctrl+S); Beat Lab also saves as you go', onclick: () => saveClick() }, 'Save'),
    share = h('button', { class: 'btn small', title: 'Share this song with a 6-digit code', onclick: () => shareDialog() }, 'Share'),
    dl = h('button', { class: 'btn small', title: 'Download the song as audio (WAV), just the drums or melody, or the project file', onclick: () => downloadDialog() }, 'Download'),
    h('div', { class: 'spacer' }), learn, seg, q, h('button', { class: 'btn small', title: 'How it works', onclick: helpDialog }, 'Help'));
  A.appbar = { name, seg, save, share, dl, learn, q };
}
function refreshAppBar() {
  if (!A.appbar) return;
  A.appbar.name.textContent = A.p.name;
  $$('button', A.appbar.seg).forEach(b => b.classList.toggle('on', b.dataset.m === A.p.mode));
}
function switchMode(target) {
  if (target === A.p.mode) return;
  if (Tutor.active && target === 'simple') return toast('Finish or skip the lesson first (Esc)', 2200);
  if (target === 'studio') {
    const empty = A.p.simple.ly.every(L => !L.mel.length) && !A.p.simple.drm.length;
    if (empty) { const p = newStudioProject('New song'); tutFollow(p); saveNow(); openProjectObj(p); Store.save(A.p); return; }
    confirmBox('Open in the Studio?', 'Your song becomes a full Studio project (a copy: this simple song stays saved too).', 'Open in Studio', openInStudio);
    return;
  }
  const last = Store.list().find(x => x.mode === 'simple');
  modal('Back to Simple mode', h('p', null, 'Simple mode has its own songs (Studio projects are too detailed for the simple grid). Your Studio project stays saved.'), [
    { t: 'Cancel' },
    last ? { t: 'Open "' + last.name + '"', f: () => openProjectObj(Store.load(last.id)) } : null,
    { t: 'New simple song', primary: true, f: () => { openProjectObj(newSimpleProject()); Store.save(A.p); } }].filter(Boolean));
}
function setMode(mode) {
  hideOffer(); if (mode !== 'studio') setExplain(false);
  A.set.mode = mode; Store.saveSet();
  document.body.dataset.mode = mode;
  $('#simple').classList.toggle('hidden', mode !== 'simple');
  $('#studio').classList.toggle('hidden', mode !== 'studio');
  if (mode === 'simple') { if (!SV.cv) buildSimple(); simpleSync(); SV.refresh(); }
  else { if (!ST.tempo) buildStudio(); fixUi(); A.eng.load(A.p); refreshStudio(); syncRackRows(true); MX.sig = ''; SY.sig = ''; PL.hsig = ''; markViews(); showTab(A.ui.tab); fillBrowser(ST.search.value); }
  refreshAppBar();
  emit('changed', true);
  queueWarm();
  // the first time in the Studio: offer the tour once (seenStudio is remembered whatever the answer)
  if (mode === 'studio' && !A.set.seenStudio && !Tutor.active) { A.set.seenStudio = 1; Store.saveSet(); if (!Tutor.done('studio1')) setTimeout(() => { if (!Tutor.active && A.p.mode === 'studio') offer('studio'); }, 400); }
}
on('changed', () => {
  if (!A.p) return;
  if (A.p.mode === 'simple') { if (SV.refresh) SV.refresh(); }
  else if (ST.tempo) refreshStudio();
  refreshAppBar();
  queueWarm();
});
let statusT = 0;
function setStatus(msg) { const s = $('#status'); if (!s) return; s.textContent = msg; clearTimeout(statusT); statusT = setTimeout(() => { s.textContent = ''; }, 2500); }

// render plucked/modal notes and drum hits ahead of time, a little at a time, so playing never waits for them
const WARM = { q: [], t: 0 };
function queueWarm() {
  clearTimeout(WARM.t);
  WARM.t = setTimeout(() => {
    const p = A.p.mode === 'simple' ? SP : A.p; if (!p) return;
    const q = [];
    for (const c of p.ch) {
      if (c.s.k === 'drm') { q.push({ d: c.s.d }); continue; }
      if (![c.s.o1.w, c.s.o2.w].some(w => w === 'pluck' || /^m:/.test(w))) continue;
      const notes = new Set();
      for (const pat of p.pat) { const nt = pat.nt[c.id]; if (nt) for (const n of nt) notes.add(n[2]); if (pat.st[c.id] && pat.st[c.id].some(v => v > 0)) notes.add(c.root || 60); }
      if (p === SP) for (let r = 0; r < sRows(A.p.simple); r++) notes.add(sMidi(A.p.simple, r));
      for (const n of notes) q.push({ s: c.s, n });
    }
    WARM.q = q;
  }, 300);
}
setInterval(() => {
  const ctx = A.eng.ctx; if (!ctx || !WARM.q.length || A.rendering) return;
  const t0 = performance.now();
  while (WARM.q.length && performance.now() - t0 < 12) {
    const it = WARM.q.shift();
    try { if (it.d) E.drumBuffer(ctx, it.d); else E.warm(ctx, it.s, [it.n]); } catch (e) { reportErr(e); }
  }
}, 60);

function boot() {
  Store.loadSet();
  buildAppBar();
  let p = A.set.last ? Store.load(A.set.last) : null;
  if (!p) { const l = Store.list(); if (l.length) p = Store.load(l[0].id); }
  if (!p) { p = newSimpleProject('My first song'); }
  A.p = openProject(p);
  if (A.p.mode === 'studio') { A.ui.pat = A.p.pat[0].id; A.ui.brush = A.ui.pat; A.ui.ch = A.p.ch[0] ? A.p.ch[0].id : null; }
  setMode(A.p.mode);
  Store.save(A.p); A.set.last = A.p.id; Store.saveSet();
  const wake = () => { A.eng.audio(); };
  document.addEventListener('pointerdown', wake, { capture: true });
  document.addEventListener('keydown', wake, { capture: true });
  requestAnimationFrame(frame);
  if (A.set.ver !== BL_VERSION) {                // a returning player gets What's New once per version
    if (A.set.seenHelp) setTimeout(() => modal('New in Beat Lab ' + BL_VERSION, whatsNew(), [{ t: 'Help', f: () => { setTimeout(helpDialog, 30); } }, { t: 'Try a lesson', f: () => { setTimeout(learnHub, 30); } }, { t: 'Let\'s go', primary: true }], { wide: true }), 500);
    A.set.ver = BL_VERSION; Store.saveSet();
  }
  if (!A.set.seenHelp && A.p.mode === 'simple') { A.set.seenHelp = 1; Store.saveSet(); setTimeout(() => { if (!Tutor.active && A.p.mode === 'simple') offer('simple'); }, 600); }
}

// ---- debug hook for tests
window.__beatlab = {
  get state() { return { mode: A.p && A.p.mode, playing: A.playing, tick: A.eng.position(), name: A.p && A.p.name, tab: A.ui.tab, ch: A.ui.ch, pat: A.ui.pat, playMode: A.ui.playMode, undo: Hist.undo.length, redo: Hist.redo.length, audio: A.eng.ctx ? A.eng.ctx.state : 'none', rec: A.ui.rec }; },
  get project() { return A.p; },
  songsApi: () => songsApi(), openSharedCode: c => openSharedCode(c), saveData: () => { saveNow(); try { return localStorage.getItem(KEY_P + A.p.id); } catch (e) { return null; } },
  get lastError() { return A.lastError || E.lastError || ''; },
  app: A, engine: A.eng, E, Store, Hist,
  load(p) { openProjectObj(typeof p === 'string' ? JSON.parse(p) : E.clone(p)); return A.p.id; },
  loadDemo(id) { const p = E.demo(id); if (!p) return null; p.id = uid(); p.mode = 'studio'; openProjectObj(p); return A.p.id; },
  newSimple() { openProjectObj(newSimpleProject('Test song')); return A.p.id; },
  newStudio() { openProjectObj(newStudioProject('Test project')); return A.p.id; },
  play(mode) { if (mode && A.p.mode === 'studio') setPlayMode(mode); startPlay(); return A.playing; },
  stop() { stopPlay(); },
  step(sec) { A.eng.step(sec || 1); return A.eng.stats.notes; },
  counts() {
    const p = A.p, out = { scheduled: A.eng.stats.notes, voices: A.eng.stats.voices };
    if (p.mode === 'simple') return Object.assign(out, { melody: p.simple.ly.reduce((n, L) => n + L.mel.length, 0), layers: p.simple.ly.length, drums: p.simple.drm.length, channels: SP ? SP.ch.length : 0 });
    let notes = 0, steps = 0; for (const q of p.pat) { for (const k in q.nt) notes += q.nt[k].length; for (const k in q.st) steps += q.st[k].filter(v => v > 0).length; }
    return Object.assign(out, { channels: p.ch.length, patterns: p.pat.length, notes, steps, clips: p.pl.cl.length, mixerFx: p.mix.reduce((n, m) => n + m.fx.length, 0) });
  },
  undo() { Hist.doUndo(); }, redo() { Hist.doRedo(); }, save() { return saveNow(); },
  switchMode(m) { if (m === 'studio' && A.p.mode === 'simple') openInStudio(); else if (m === 'simple' && A.p.mode === 'studio') { openProjectObj(newSimpleProject()); } return A.p.mode; },
  openInStudio() { openInStudio(); return A.p.mode; },
  tab(t) { showTab(t); },
  async render(o) { const proj = A.p.mode === 'simple' ? simpleToProject(A.p.simple, A.p.name) : A.p; const buf = await E.render(proj, o || (A.p.mode === 'simple' ? { mode: 'pat', pat: 1 } : { mode: 'song' })); return E.bufferStats(buf); },
  simpleProject() { return SP; }, stemProject,
  tut: { start: id => tutStart(id), stop: () => tutStop('skip'), next: () => Tutor.next(), back: () => Tutor.back(), keep: () => tutKeep(), xy: tutXY, learn: () => learnHub(), explain: on => setExplain(on),
    lessons: () => LESSONS.map(l => ({ id: l.id, title: l.title, steps: l.steps.length })),
    get state() { const l = TT.les; return { active: !!l, id: l ? l.id : null, step: TT.i, of: l ? l.steps.length : 0, finale: !!l && TT.i >= l.steps.length, title: l && TT.i < l.steps.length ? l.steps[TT.i].title : '', done: Object.assign({}, A.set.tut), temp: isTemp(), kept: TT.kept, prog: TT.el ? TT.el.prog.textContent : '' }; } },
  presets() { return { total: E.PRESETS.length, categories: E.CATEGORIES.length, drums: E.PRESETS.filter(x => x.p.k === 'drm').length }; }
};
boot();
