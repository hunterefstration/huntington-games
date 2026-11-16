// ===== Projects: open/new/rename/duplicate/delete, demos, import/export (.json), WAV export, help =====
function openProjectObj(p, keepHist) {
  if (A.playing) stopPlay();
  if (A.p) saveNow();
  A.p = openProject(p);
  if (!keepHist) Hist.clear();
  A.set.last = A.p.id; Store.saveSet();
  if (A.p.mode === 'studio') { A.ui.pat = A.p.pat[0].id; A.ui.brush = A.ui.pat; A.ui.ch = A.p.ch[0] ? A.p.ch[0].id : null; A.ui.startTick = 0; RL.init = false; PL.sx = 0; }
  setMode(A.p.mode);
}
function projectsDialog() {
  if (A.p) saveNow();
  const list = Store.list(), used = Store.usage();
  const rows = h('div', { class: 'plist' });
  if (!list.length) rows.appendChild(h('p', { class: 'hint' }, 'No saved projects yet.'));
  for (const it of list) {
    const cur = A.p && it.id === A.p.id;
    rows.appendChild(h('div', { class: 'prow' + (cur ? ' cur' : '') },
      h('div', { class: 'pmeta' }, h('b', null, it.name), h('span', { class: 'badge ' + it.mode }, it.mode === 'simple' ? 'Simple' : 'Studio'),
        h('span', { class: 'hint' }, new Date(it.t || Date.now()).toLocaleString() + ' · ' + Math.max(1, Math.round(it.size / 1024)) + ' KB' + (it.size > LIMIT_KEY ? ' (too big to sync)' : ''))),
      h('div', { class: 'pact' },
        cur ? h('span', { class: 'hint' }, 'open now') : h('button', { class: 'btn small primary', onclick: () => { closeModal(); const p = Store.load(it.id); if (p) openProjectObj(p); else toast('Could not open that project'); } }, 'Open'),
        h('button', { class: 'btn small', onclick: () => { closeModal(); ask('Rename project', it.name, v => { const p = cur ? A.p : Store.load(it.id); if (!p) return; p.name = v; Store.save(p); if (cur) refreshAppBar(); projectsDialog(); }); } }, 'Rename'),
        h('button', { class: 'btn small', onclick: () => { const p = cur ? E.clone(A.p) : Store.load(it.id); if (!p) return; p.id = uid(); p.name = it.name + ' copy'; Store.save(p); projectsDialog(); } }, 'Duplicate'),
        h('button', { class: 'btn small', onclick: () => { const p = cur ? A.p : Store.load(it.id); if (p) exportProject(p); } }, 'Export'),
        h('button', { class: 'btn small danger', onclick: () => { closeModal(); confirmBox('Delete "' + it.name + '"?', 'This cannot be undone (export it first if you might want it back).', 'Delete', () => {
          Store.remove(it.id);
          if (cur) { const rest = Store.list(); if (rest.length) openProjectObj(Store.load(rest[0].id)); else openProjectObj(newSimpleProject()); }
          setTimeout(projectsDialog, 50);
        }); } }, 'Delete'))));
  }
  const demos = h('div', { class: 'demos' }, E.DEMOS.map(d => h('button', { class: 'demo', title: d.desc, onclick: () => { closeModal(); const p = E.demo(d.id); p.id = uid(); p.mode = 'studio'; openProjectObj(p); Store.save(A.p); toast('Opened the demo "' + d.n + '". Press Space to play.', 3000); } }, h('b', null, d.n), h('span', null, d.desc))));
  const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  file.addEventListener('change', () => { const f = file.files[0]; if (f) importFile(f); });
  const body = h('div', null,
    h('div', { class: 'prow-top' },
      h('button', { class: 'btn primary', onclick: () => { closeModal(); ask('New Studio project', 'New song', n => { openProjectObj(newStudioProject(n)); Store.save(A.p); }); } }, 'New Studio project'),
      h('button', { class: 'btn', onclick: () => { closeModal(); ask('New simple song', 'My song', n => { openProjectObj(newSimpleProject(n)); Store.save(A.p); }); } }, 'New simple song'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Import a project file...'), file),
    h('h4', null, 'Demo projects'), demos,
    h('h4', null, 'Your projects'), rows,
    h('p', { class: 'hint' }, 'Projects save as you work and sync to your account. Using ' + Math.round(used / 1024) + ' KB of 6 MB.'));
  modal('Projects', body, [{ t: 'Close' }], { wide: true });
}
function exportProject(p) { download(safeName(p.name) + '.beatlab.json', JSON.stringify(p), 'application/json'); toast('Exported ' + p.name); }
function importFile(f) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const p = JSON.parse(rd.result);
      if (!p || typeof p !== 'object' || !(Array.isArray(p.ch) || p.simple)) throw new Error('not a Beat Lab project');
      p.id = uid(); if (!p.name) p.name = f.name.replace(/\.(beatlab\.)?json$/i, '');
      closeModal(); openProjectObj(p); Store.save(A.p);
      toast('Imported "' + A.p.name + '"');
    } catch (e) { toast('That file is not a Beat Lab project (' + e.message + ').', 4000); }
  };
  rd.readAsText(f);
}
// ---- WAV export
async function exportWav(simple) {
  if (A.rendering) return;
  const isSimple = simple || A.p.mode === 'simple';
  let opts = { mode: 'song' }, proj = isSimple ? simpleToProject(A.p.simple, A.p.name) : A.p;
  if (isSimple) opts = { mode: 'pat', pat: 1, loops: 2 };
  else if (!A.p.pl.cl.length) opts = { mode: 'pat', pat: A.ui.pat, loops: 4 };
  const go = async () => {
    const bar = h('div', { class: 'pbar' }, h('i')), txt = h('p', { class: 'hint' }, 'Rendering...');
    const box = modal('Exporting WAV', h('div', null, txt, bar), [], { sticky: true });
    A.rendering = true;
    try {
      const t0 = performance.now();
      const buf = await E.render(proj, Object.assign({}, opts, { onProgress: f => { $('i', bar).style.width = Math.round(f * 100) + '%'; txt.textContent = 'Rendering... ' + Math.round(f * 100) + '%'; } }));
      const st = E.bufferStats(buf); A.lastRender = st;
      const wav = E.toWav(buf);
      download(safeName(A.p.name) + '.wav', new Blob([wav], { type: 'audio/wav' }));
      closeModal();
      toast('Saved ' + safeName(A.p.name) + '.wav (' + fmtTime(buf.duration) + ', ' + (wav.byteLength / 1048576).toFixed(1) + ' MB) in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s', 4000);
    } catch (e) { reportErr(e); closeModal(); toast('Export failed: ' + e.message, 5000); }
    A.rendering = false;
    void box;
  };
  if (isSimple || !A.p.pl.cl.length) return go();
  const choice = select([['song', 'The whole song (playlist)'], ['pat', 'Just the pattern "' + curPat().n + '" (4 times)'], ['loop', 'The loop region']].filter(o => o[0] !== 'loop' || A.p.loop), 'song', () => {});
  modal('Export WAV', h('div', null, h('p', null, 'What should go in the file?'), choice), [{ t: 'Cancel' }, { t: 'Export', primary: true, f: () => {
    if (choice.value === 'pat') opts = { mode: 'pat', pat: A.ui.pat, loops: 4 };
    else if (choice.value === 'loop') opts = { mode: 'song', from: A.p.loop[0] * STEP, to: A.p.loop[1] * STEP };
    setTimeout(go, 30);
  } }]);
}
function helpDialog() {
  const body = h('div', { class: 'help' },
    h('h4', null, 'Simple mode'),
    h('p', null, 'Click squares to add notes, click again to remove them, drag to paint. The top part is the tune (higher rows are higher notes), the bottom rows are drums. Pick an instrument and a drum kit with the big buttons, then press Play. Try "Surprise me!" or a song to start from. When you want more, press "Open in Studio".'),
    h('h4', null, 'Studio mode'),
    h('ul', null,
      h('li', null, h('b', null, 'Channel rack'), ': every instrument is a channel. Click the steps to make a beat. Double-click a channel name to edit its sound. Drag a sound from the browser onto a channel to swap it.'),
      h('li', null, h('b', null, 'Piano roll'), ': draw notes for the selected channel. Drag to move, drag the right end to resize, right-click to delete. Ctrl-drag selects; Ctrl+C / Ctrl+V / Ctrl+D copy, paste and duplicate; arrow keys move (Shift: an octave). The Chord tool stamps whole chords.'),
      h('li', null, h('b', null, 'Patterns and Playlist'), ': a pattern is a loop of steps and notes. Put patterns on the playlist to arrange the song. Drag in the ruler to loop a part. Switch between Pattern and Song at the top.'),
      h('li', null, h('b', null, 'Mixer'), ': each channel plays into a mixer track (the number next to its name). Add effects (EQ, compressor, reverb, delay...) to tracks. The master has a limiter so nothing clips.'),
      h('li', null, h('b', null, 'Recording'), ': choose a channel, press the red button (or Ctrl+Enter), and play with your computer keyboard (Z S X D C V... is the lower octave, Q 2 W 3 E... the upper one, [ and ] change octave) or a MIDI keyboard.')),
    h('h4', null, 'Shortcuts'),
    h('p', null, 'Space play/stop · Ctrl+Z undo · Ctrl+Y redo · Ctrl+S save · Delete removes the selection · F5-F9 or Alt+1-5 switch views · Ctrl+mouse wheel zooms, Shift+wheel scrolls sideways, Alt+wheel changes row height. Shift+T opens the chat.'));
  modal('How Beat Lab works', body, [{ t: 'Got it', primary: true }], { wide: true });
}
