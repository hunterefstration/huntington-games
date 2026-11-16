// ===== Studio shell: transport bar, tabs, preset browser, pattern picker, shortcuts, play/stop, the draw loop =====
const TABS = [['playlist', 'Playlist', 'F5'], ['rack', 'Channel rack', 'F6'], ['roll', 'Piano roll', 'F7'], ['synth', 'Instrument', 'F8'], ['mixer', 'Mixer', 'F9']];
const ST = {};
function buildStudio() {
  const root = $('#studio');
  root.innerHTML = '';
  // ---- transport
  const modeBtn = h('div', { class: 'seg', title: 'Play the current pattern, or the whole song (playlist)' },
    h('button', { 'data-m': 'pat', onclick: () => setPlayMode('pat') }, 'Pattern'), h('button', { 'data-m': 'song', onclick: () => setPlayMode('song') }, 'Song'));
  const play = h('button', { class: 'tbtn play', title: 'Play / stop (Space)', onclick: () => togglePlay() }, h('span', { class: 'pi' }));
  const stop = h('button', { class: 'tbtn stop', title: 'Stop and go back to the start', onclick: () => { stopPlay(); A.ui.startTick = 0; markViews(); } }, h('span', { class: 'si' }));
  const rec = h('button', { class: 'tbtn rec', title: 'Record from your computer keyboard or MIDI (Ctrl+Enter)', onclick: () => toggleRecord() }, h('span', { class: 'ri' }));
  const pos = h('div', { class: 'pos', title: 'Bar : beat : step' }, '1:1:1');
  const tempo = dragNum({ label: 'BPM', value: 120, min: 40, max: 300, title: 'Tempo: drag up/down, or click to type', undo: 'Change tempo', onInput: v => { A.p.bpm = v; changed(); } });
  const sig = select([['3,4', '3/4'], ['4,4', '4/4'], ['5,4', '5/4'], ['6,8', '6/8'], ['7,8', '7/8']], '4,4', v => Hist.edit('Time signature', () => { A.p.sig = v.split(',').map(Number); }), 'small');
  sig.title = 'Time signature';
  const metro = toggleBtn('Metronome', false, v => { A.set.metro = v ? 1 : 0; A.eng.metro = v; Store.saveSet(); }, 'Click on every beat');
  const countIn = toggleBtn('Count-in', true, v => { A.set.countIn = v ? 1 : 0; Store.saveSet(); }, 'One bar of clicks before recording starts');
  const recQ = select([[0, 'Rec: no snap'], [3, 'Rec: 1/16 beat'], [6, 'Rec: 1/8 beat'], [12, 'Rec: 1/4 beat'], [24, 'Rec: 1/2 beat'], [48, 'Rec: 1 beat'], [8, 'Rec: 1/6 beat'], [16, 'Rec: 1/3 beat']], A.set.recQ, v => { A.set.recQ = +v; Store.saveSet(); }, 'small');
  recQ.title = 'Recording quantize: recorded notes snap to this grid';
  const swing = knob({ label: 'Swing', min: 0, max: 100, value: 0, def: 0, curve: 'int', small: true, unit: '%', fmt: v => v + '%', undo: 'Change swing', onInput: v => { A.p.swing = v; changed(); } });
  const patSel = h('select', { class: 'sel pat', title: 'Pattern to edit (and to play in Pattern mode)' });
  patSel.addEventListener('change', () => { selectPattern(+patSel.value); patSel.blur(); });
  patSel.addEventListener('keydown', e => e.stopPropagation());
  const patAdd = h('button', { class: 'btn small', title: 'New pattern', onclick: () => newPattern() }, '+');
  const patMenu = h('button', { class: 'btn small', title: 'Pattern options', onclick: e => patternMenu(e.clientX, e.clientY) }, '⋯');
  const keysT = toggleBtn('Keys', true, v => { A.set.keys = v ? 1 : 0; Store.saveSet(); }, 'Play the selected instrument with your computer keyboard: Z S X D C... and Q 2 W 3 E... ([ and ] change octave)');
  const midiB = h('button', { class: 'btn small', title: 'Use a MIDI keyboard', onclick: () => connectMidi() }, 'MIDI');
  const wav = h('button', { class: 'btn small', title: 'Export the song as a WAV file', onclick: () => exportWav() }, 'Export WAV');
  const cpu = h('div', { class: 'cpu', title: 'Notes sounding right now' }, '');
  const bar = h('div', { class: 'st-bar' }, modeBtn, play, stop, rec, pos, tempo, sig, metro, countIn, recQ, swing,
    h('div', { class: 'grp' }, h('span', { class: 'lab' }, 'Pattern'), patSel, patAdd, patMenu),
    h('div', { class: 'grp' }, h('button', { class: 'btn small', title: 'Undo (Ctrl+Z)', onclick: () => Hist.doUndo() }, 'Undo'), h('button', { class: 'btn small', title: 'Redo (Ctrl+Y)', onclick: () => Hist.doRedo() }, 'Redo')),
    keysT, midiB, wav, cpu);
  // ---- browser
  const search = h('input', { type: 'search', class: 'txt', placeholder: 'Search ' + E.PRESETS.length + ' sounds...' });
  search.addEventListener('input', () => fillBrowser(search.value));
  search.addEventListener('keydown', e => e.stopPropagation());
  const list = h('div', { class: 'blist' });
  const browser = h('aside', { id: 'browser' }, h('div', { class: 'bhead' }, h('b', null, 'Sounds'), h('span', { class: 'hint' }, 'click: listen · double-click: load · +: add')), search, list);
  // ---- tabs + panes
  const tabs = h('nav', { class: 'tabs' }, TABS.map(([id, n, k]) => h('button', { 'data-t': id, title: n + ' (' + k + ' or Alt+' + (TABS.findIndex(t => t[0] === id) + 1) + ')', onclick: () => showTab(id) }, n)));
  const panes = h('div', { class: 'panes' }, TABS.map(([id]) => h('div', { class: 'pane', id: 'pane-' + id })));
  root.append(bar, h('div', { class: 'st-main' }, browser, h('section', { class: 'st-work' }, tabs, panes)));
  Object.assign(ST, { modeBtn, play, rec, pos, tempo, sig, metro, countIn, recQ, swing, patSel, keysT, cpu, list, search, tabs });
  buildRack($('#pane-rack')); buildRoll($('#pane-roll')); buildPlaylist($('#pane-playlist')); buildMixer($('#pane-mixer')); buildSynth($('#pane-synth'));
  fillBrowser('');
}
function refreshStudio() {
  if (!ST.tempo) return;
  ST.tempo.set(A.p.bpm); ST.sig.value = A.p.sig.join(','); ST.swing.set(A.p.swing);
  ST.metro.set(A.set.metro); ST.countIn.set(A.set.countIn); ST.keysT.set(A.set.keys);
  $$('button', ST.modeBtn).forEach(b => b.classList.toggle('on', b.dataset.m === A.ui.playMode));
  const sel = ST.patSel, psig = A.p.pat.map(q => q.id + q.n).join('|');
  if (psig !== ST.psig) { ST.psig = psig; sel.innerHTML = ''; for (const q of A.p.pat) sel.appendChild(h('option', { value: q.id }, q.n)); }
  sel.value = A.ui.pat; ST.recQ.value = A.set.recQ;
  $$('button', ST.tabs).forEach(b => b.classList.toggle('on', b.dataset.t === A.ui.tab));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + A.ui.tab));
}
function markViews() { for (const k in A.views) A.views[k].dirty = true; }
function showTab(id) {
  A.ui.tab = id;
  $$('button', ST.tabs).forEach(b => b.classList.toggle('on', b.dataset.t === id));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + id));
  const v = A.views[id]; if (v) { v.dirty = true; if (v.show) v.show(); }
}
function setPlayMode(m) {
  A.ui.playMode = m;
  $$('button', ST.modeBtn).forEach(b => b.classList.toggle('on', b.dataset.m === m));
  if (A.playing) { A.eng.setMode(m, A.ui.pat); A.eng.seek(m === 'song' ? A.ui.startTick : 0); }
}
function selectPattern(id) {
  A.ui.pat = id; A.ui.brush = id; RL.init = false; RL.sel.clear();
  if (ST.patSel) ST.patSel.value = id;
  if (A.playing && A.ui.playMode === 'pat') A.eng.setMode('pat', id);
  markViews();
}
function newPattern(cloneOf) {
  Hist.edit(cloneOf ? 'Clone pattern' : 'New pattern', () => {
    const id = A.p.pat.reduce((m, q) => Math.max(m, q.id), 0) + 1;
    const q = cloneOf ? E.clone(cloneOf) : { len: E.barTicks(A.p) / STEP * 1, st: {}, nt: {} };
    q.id = id; q.n = cloneOf ? cloneOf.n + ' copy' : 'Pattern ' + id; q.col = CH_COLS[(id * 5) % CH_COLS.length];
    if (!cloneOf) q.len = Math.max(16, E.barTicks(A.p) / STEP);
    A.p.pat.push(q); A.ui.pat = id; A.ui.brush = id;
  });
  refreshStudio(); selectPattern(A.ui.pat);
}
function patternMenu(x, y) {
  const q = curPat();
  menu(x, y, [
    { t: 'Rename...', f: () => ask('Rename pattern', q.n, v => Hist.edit('Rename pattern', () => { q.n = v; })) },
    { t: 'Clone', f: () => newPattern(q) },
    { t: 'Length: 1 bar', f: () => setPatLen(1) }, { t: 'Length: 2 bars', f: () => setPatLen(2) }, { t: 'Length: 4 bars', f: () => setPatLen(4) }, { t: 'Length: 8 bars', f: () => setPatLen(8) },
    { sep: 1 },
    { t: 'Clear this pattern', f: () => Hist.edit('Clear pattern', () => { q.st = {}; q.nt = {}; }) },
    { t: 'Delete pattern', dis: A.p.pat.length < 2, f: () => confirmBox('Delete "' + q.n + '"?', 'Its clips leave the playlist too.', 'Delete', () => Hist.edit('Delete pattern', () => {
      A.p.pat = A.p.pat.filter(x => x !== q); A.p.pl.cl = A.p.pl.cl.filter(c => c[0] !== q.id); fixUi();
    })) }
  ]);
}
function setPatLen(bars) { Hist.edit('Pattern length', () => { const q = curPat(); q.len = Math.round(bars * E.barTicks(A.p) / STEP); for (const k in q.st) { const a = q.st[k]; while (a.length < q.len) a.push(0); } }); }

// ---- preset browser
let browserOpen = { Keys: true };
function fillBrowser(q) {
  const list = ST.list; list.innerHTML = '';
  q = (q || '').trim().toLowerCase();
  const user = Store.userPresets();
  const all = user.concat(E.PRESETS);
  const cats = (user.length ? ['User'] : []).concat(E.CATEGORIES);
  for (const c of cats) {
    const items = all.filter(p => p.c === c && (!q || p.n.toLowerCase().includes(q) || c.toLowerCase().includes(q)));
    if (!items.length) continue;
    const open = q || browserOpen[c];
    const head = h('button', { class: 'bcat' + (open ? ' open' : ''), onclick: () => { browserOpen[c] = !browserOpen[c]; fillBrowser(ST.search.value); } }, h('span', null, c), h('em', null, items.length));
    list.appendChild(head);
    if (!open) continue;
    for (const p of items) {
      const row = h('div', { class: 'bitem', draggable: 'true', title: p.n + ' (' + c + ')' },
        h('span', { class: 'bn' }, p.n),
        h('button', { class: 'badd', title: 'Add as a new channel', onclick: e => { e.stopPropagation(); addChannelFromPreset(p.id); } }, '+'));
      row.addEventListener('click', () => { $$('.bitem.sel', list).forEach(x => x.classList.remove('sel')); row.classList.add('sel'); A.eng.preview(E.normParams(p.p), p.p.k === 'drm' ? 60 : 60, 0.85, 0.7); });
      row.addEventListener('dblclick', () => loadPresetIntoChannel(p.id));
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/beatlab-preset', p.id); e.dataTransfer.effectAllowed = 'copy'; });
      if (p.c === 'User') row.addEventListener('contextmenu', e => { e.preventDefault(); menu(e.clientX, e.clientY, [{ t: 'Delete user preset', f: () => { Store.deleteUserPreset(p.id); fillBrowser(ST.search.value); } }]); });
      list.appendChild(row);
    }
  }
  if (!list.children.length) list.appendChild(h('div', { class: 'empty' }, 'No sounds match.'));
}
function addChannelFromPreset(pid) {
  let c;
  Hist.edit('Add channel', () => { c = newChannel(A.p, pid); c.mix = freeInsert(A.p); if (A.p.mix[c.mix] && c.mix > 0) A.p.mix[c.mix].n = c.n; A.ui.ch = c.id; });
  toast('Added ' + c.n);
  markViews();
}
function loadPresetIntoChannel(pid, chId) {
  const c = chId ? chById(chId) : curCh(); if (!c) return addChannelFromPreset(pid);
  const info = presetById(pid); if (!info) return;
  Hist.edit('Load ' + info.n, () => { const keepName = c.n !== (presetById(c.p) || {}).n; c.p = info.id; c.s = E.normParams(info.p); if (!keepName) c.n = info.n; });
  toast(c.n + ': ' + info.n);
}

// ---- transport
function togglePlay() { if (A.playing) stopPlay(); else startPlay(); }
function startPlay(countIn) {
  A.eng.audio();
  if (A.p.mode === 'simple') { simpleSync(); A.eng.metro = false; A.eng.play({ mode: 'pat', pat: 1 }); }
  else {
    if (A.ui.playMode === 'song' && !A.p.pl.cl.length) { setPlayMode('pat'); toast('The playlist is empty, so the pattern plays. Place patterns in the Playlist to build a song.', 3500); }
    A.eng.load(A.p); A.eng.metro = !!A.set.metro;
    A.eng.play({ mode: A.ui.playMode, pat: A.ui.pat, from: A.ui.playMode === 'song' ? A.ui.startTick : 0, countIn: countIn || 0 });
  }
  A.playing = true;
  document.body.classList.add('playing');
}
function stopPlay() {
  if (A.ui.rec) finishRecording();
  A.eng.stop(); A.playing = false;
  document.body.classList.remove('playing');
  markViews(); SV.dirty = true;
}
function updateTransport(pos) {
  if (!ST.pos) return;
  let t = pos == null ? (A.ui.playMode === 'song' ? A.ui.startTick : 0) : Math.max(0, pos);
  const bar = E.barTicks(A.p), beat = PPQ * 4 / A.p.sig[1];
  const txt = (Math.floor(t / bar) + 1) + ':' + (Math.floor((t % bar) / beat) + 1) + ':' + (Math.floor((t % beat) / STEP) + 1);
  if (ST.pos.textContent !== txt) ST.pos.textContent = txt;
  const cpu = A.eng.stats.voices + ' voices';
  if (ST.cpu.textContent !== cpu) ST.cpu.textContent = cpu;
}

// ---- keyboard
document.addEventListener('keydown', e => {
  if (!A.p) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
  if ($('#modal')) { if (e.key === 'Escape') closeModal(); return; }
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  if (k === ' ' && !ctrl) { e.preventDefault(); if (t && t.blur) t.blur(); togglePlay(); return; }
  if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) Hist.doRedo(); else Hist.doUndo(); return; }
  if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); Hist.doRedo(); return; }
  if (ctrl && (k === 's' || k === 'S')) { e.preventDefault(); if (saveNow()) toast('Saved'); return; }
  if (A.p.mode !== 'studio') return;
  if (ctrl && k === 'Enter') { e.preventDefault(); toggleRecord(); return; }
  const fk = { F5: 'playlist', F6: 'rack', F7: 'roll', F8: 'synth', F9: 'mixer' }[k];
  if (fk) { e.preventDefault(); showTab(fk); return; }
  if (e.altKey && /^[1-5]$/.test(k)) { e.preventDefault(); showTab(TABS[+k - 1][0]); return; }
  const v = A.views[A.ui.tab];
  if (v && v.key && v.key(e)) { e.preventDefault(); return; }
  if (!ctrl && !e.altKey && A.set.keys && typingNoteDown(e)) { e.preventDefault(); return; }
});
document.addEventListener('keyup', e => { if (A.p && A.p.mode === 'studio') typingNoteUp(e); });

// ---- the draw loop: only what is visible and changed, plus playheads while playing
function frame() {
  requestAnimationFrame(frame);
  if (!A.p || document.hidden) return;
  let pos = null;
  try {
    if (A.playing) { pos = A.eng.position(); if (pos != null && pos < 0) pos = null; }
    if (A.p.mode === 'simple') { if (SV.cv && (SV.dirty || A.playing)) drawSimple(pos); return; }
    const v = A.views[A.ui.tab];
    if (v) { if (v.dirty) { v.dirty = false; v.draw(); } if (v.overlay) v.overlay(pos); }
    updateTransport(pos);
    if (A.ui.rec) recordTick(pos);
  } catch (e) { reportErr(e); }
}
