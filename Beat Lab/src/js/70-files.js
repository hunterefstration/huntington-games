// ===== Projects: open/new/rename/duplicate/delete, demos, import/export (.json), WAV export, help, share codes, downloads =====
function openProjectObj(p, keepHist) {
  if (A.playing) stopPlay();
  saveIfChanged();
  A.p = openProject(p);
  if (!keepHist) Hist.clear();
  if (!A.temp.has(A.p.id)) { A.set.last = A.p.id; Store.saveSet(); }          // a tutorial's practice song is never "last"
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
    h('p', { class: 'in-game' }, h('b', null, 'Your song could be in a game! '), 'Great songs may be picked to play in one of our games: share yours in #music.'),
    h('div', { class: 'prow-top' },
      h('button', { class: 'btn primary', onclick: () => { closeModal(); ask('New Studio project', 'New song', n => { openProjectObj(newStudioProject(n)); Store.save(A.p); }); } }, 'New Studio project'),
      h('button', { class: 'btn', onclick: () => { closeModal(); ask('New simple song', 'My song', n => { openProjectObj(newSimpleProject(n)); Store.save(A.p); }); } }, 'New simple song'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Import a project file...'), file),
    codeField(),
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
async function exportWav(simple, stem) {               // stem: 'drums' | 'melody' (only those channels)
  if (A.rendering) return;
  const isSimple = simple || A.p.mode === 'simple';
  let opts = { mode: 'song' }, proj = isSimple ? simpleToProject(A.p.simple, A.p.name) : A.p;
  if (stem) { proj = stemProject(proj, stem); if (!proj) return toast(stem === 'drums' ? 'This song has no drums yet' : 'This song has only drums', 3000); }
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
      const wav = E.toWav(buf), fname = safeName(A.p.name) + (stem ? '_' + stem : '') + '.wav', blob = new Blob([wav], { type: 'audio/wav' });
      closeModal();
      // a click of its own: browsers may refuse a download that comes seconds after the original click
      modal('Your WAV is ready', h('p', null, fname + ': ' + fmtTime(buf.duration) + ', ' + (wav.byteLength / 1048576).toFixed(1) + ' MB, made in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s.'),
        [{ t: 'Close' }, { t: 'Download', primary: true, f: () => download(fname, blob) }]);
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
function whatsNew() {
  return h('div', { class: 'help' },
    h('ul', null,
      h('li', null, h('b', null, 'Learn'), ': hands-on lessons (the Learn button, top right). Six short ones, from Simple mode in 1 minute to finishing and sharing a Studio song. You do each step yourself, with a practice song, so your own songs are never touched. Finished lessons get a tick.'),
      h('li', null, h('b', null, 'What is this?'), ': in the Studio, press ? (top right) and point at any panel (or press and hold on a touch screen) for a one-line explanation.'),
      h('li', null, h('b', null, 'Your song could be in a game'), ': great songs may be picked to play in one of our games. Share yours in #music!')));
}
function whatsNew11() {
  return h('div', { class: 'help' },
    h('ul', null,
      h('li', null, h('b', null, 'Layers'), ': in Simple mode, "+ Layer" stacks up to 4 instruments, each with its own notes, volume and mute (M). Click a layer to paint in it; the others show faintly in their colours. ⋯ doubles a layer with a second sound or copies its notes to a new layer. Open in Studio gives every layer its own channel.'),
      h('li', null, h('b', null, 'More drums'), ': 8 drum rows (kick, snare, closed and open hat, clap, tom, percussion, crash) and new kits: Rock, World percussion and Orchestra (timpani, snare roll, cymbals, gong). In the Studio, "+ New drum kit" adds a whole kit at once and the browser has a Drums & Percussion section.'),
      h('li', null, h('b', null, 'Articulations'), ': play notes differently: Accent (>), Staccato (•), Slide (/), Vibrato (~), Soft (p), Bend up, Fall, Flam and Roll. Simple mode: pick a Brush and click notes. Piano roll: select notes and pick a Style. Channel rack: pick a Style and click steps.'),
      h('li', null, h('b', null, 'Share and download'), ': Share gives your song a 6-digit code (and can post it in #music); type a friend\'s code into Projects, "Open a code", to get your own copy. Download saves the song as a WAV, just the drums or just the melody, or the project file.')));
}
function helpDialog() {
  const body = h('div', { class: 'help' },
    h('h4', null, 'New in version ' + BL_VERSION), whatsNew(),
    h('h4', null, 'Learn by doing'),
    h('p', null, 'New to music software? Press ', h('b', null, 'Learn'), ' for short lessons that walk you through Simple mode and every part of the Studio. Esc or "Skip lesson" leaves a lesson at any time.'),
    h('h4', null, 'Simple mode'),
    h('p', null, 'Click squares to add notes, click again to remove them, drag to paint. The top part is the tune (higher rows are higher notes), the bottom rows are drums. Pick an instrument and a drum kit with the big buttons, then press Play. Try "Surprise me!" or a song to start from. "+ Layer" adds another instrument on top; the Brush buttons (Accent, Staccato, Slide...) change how the notes you click are played. When you want more, press "Open in Studio".'),
    h('h4', null, 'Studio mode'),
    h('ul', null,
      h('li', null, h('b', null, 'Channel rack'), ': every instrument is a channel. Click the steps to make a beat. Double-click a channel name to edit its sound. Drag a sound from the browser onto a channel to swap it.'),
      h('li', null, h('b', null, 'Piano roll'), ': draw notes for the selected channel. Drag to move, drag the right end to resize, right-click to delete. Ctrl-drag selects; Ctrl+C / Ctrl+V / Ctrl+D copy, paste and duplicate; arrow keys move (Shift: an octave). The Chord tool stamps whole chords. Style sets the articulation of the selected notes (and of new ones); each note shows its sign.'),
      h('li', null, h('b', null, 'Patterns and Playlist'), ': a pattern is a loop of steps and notes. Put patterns on the playlist to arrange the song. Drag in the ruler to loop a part. Switch between Pattern and Song at the top.'),
      h('li', null, h('b', null, 'Mixer'), ': each channel plays into a mixer track (the number next to its name). Add effects (EQ, compressor, reverb, delay...) to tracks. The master has a limiter so nothing clips.'),
      h('li', null, h('b', null, 'Recording'), ': choose a channel, press the red button (or Ctrl+Enter), and play with your computer keyboard (Z S X D C V... is the lower octave, Q 2 W 3 E... the upper one, [ and ] change octave) or a MIDI keyboard.')),
    h('h4', null, 'New in version 1.1'), whatsNew11(),
    h('h4', null, 'Shortcuts'),
    h('p', null, 'Space play/stop · Ctrl+Z undo · Ctrl+Y redo · Ctrl+S save · Delete removes the selection · F5-F9 or Alt+1-5 switch views · Ctrl+mouse wheel zooms, Shift+wheel scrolls sideways, Alt+wheel changes row height. Shift+T opens the chat.'));
  modal('How Beat Lab works (version ' + BL_VERSION + ')', body, [{ t: 'Got it', primary: true }], { wide: true });
}

// ---- sharing with a 6-digit code (2026-11-16). The launcher's account layer stores the song: parent.HGGrapevine.songs
// { share({ name, data, post }) -> {ok, code, err}, get(code) -> {ok, name, by, at, data, err} }. Missing when Beat Lab
// runs on its own or the player is signed out: then sharing says so and everything else works.
const SHARE_MAX = 200 * 1024;
function songsApi() { try { const g = parent.HGGrapevine; return g && g.songs && typeof g.songs.share === 'function' ? g.songs : null; } catch (e) { return null; } }
function shareDialog() {
  const api = songsApi();
  if (!api) { modal('Share this song', h('div', null, h('p', null, 'Sign in to the launcher to share. Shared songs get a 6-digit code your friends type into Beat Lab to hear (and remix) your song.'), h('p', { class: 'in-game' }, h('b', null, 'Your song could be in a game! '), 'Great songs may be picked to play in one of our games: share yours in #music.'), codeField()), [{ t: 'OK' }]); A.ui.dlg = 'share'; return; }
  saveNow();
  const data = JSON.stringify(A.p);
  const big = data.length > SHARE_MAX;
  const post = h('input', { type: 'checkbox', id: 'sh-post' });
  const out = h('div', { class: 'sh-out' });
  const go = h('button', { class: 'btn primary', onclick: async () => {
    go.disabled = true; out.innerHTML = ''; out.appendChild(h('p', { class: 'hint' }, 'Sharing...'));
    let r;
    try { r = await api.share({ name: A.p.name, data, post: post.checked }); } catch (e) { r = { ok: false, err: e && e.message || 'Could not reach the launcher' }; }
    out.innerHTML = '';
    if (!r || !r.ok || !r.code) { go.disabled = false; out.appendChild(h('p', { class: 'sh-err' }, (r && r.err) || 'Sharing did not work. Try again in a minute.')); return; }
    A.lastShare = r.code;
    const copy = h('button', { class: 'btn', onclick: () => { try { navigator.clipboard.writeText(r.code); toast('Copied ' + r.code); } catch (e) { toast('Copy it by hand: ' + r.code); } } }, 'Copy');
    out.append(h('div', { class: 'sh-code', id: 'sh-code' }, r.code), h('div', { class: 'sh-row' }, copy, h('span', { class: 'hint' }, post.checked ? 'Posted in #music too.' : 'Give this code to a friend: they type it into Beat Lab (Projects, "Open a code").')));
  } }, 'Get a code');
  modal('Share "' + A.p.name + '"', h('div', null,
    h('p', null, 'Get a 6-digit code for this song. Anyone with the code can open their own copy (yours stays yours).'),
    big ? h('p', { class: 'sh-err' }, 'This song is ' + Math.round(data.length / 1024) + ' KB: songs over 200 KB are too big to share. Try fewer patterns or a shorter song.') : null,
    h('label', { class: 'sh-row' }, post, ' Post it in #music (everyone sees the name and the code)'),
    h('p', { class: 'in-game' }, h('b', null, 'Your song could be in a game! '), 'Great songs may be picked to play in one of our games: share yours in #music.'),
    h('div', { class: 'sh-row' }, big ? null : go), out,
    h('h4', null, 'Got a code from a friend?'), codeField()), [{ t: 'Close' }]);
  A.ui.dlg = 'share';
}
// "Open a code": a small field; opening loads the song as a NEW project named "<name> (by <player>)"
function codeField() {
  const inp = h('input', { type: 'text', class: 'txt sh-in', inputmode: 'numeric', maxlength: 6, placeholder: '123456', 'aria-label': 'Song code' });
  const btn = h('button', { class: 'btn', onclick: () => openSharedCode(inp.value) }, 'Open');
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') openSharedCode(inp.value); });
  return h('div', { class: 'sh-row codefield' }, h('span', { class: 'lab' }, 'Open a code'), inp, btn);
}
async function openSharedCode(code) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length !== 6) return toast('A song code has 6 digits');
  const api = songsApi();
  if (!api) return toast('Sign in to the launcher to open shared songs', 3500);
  let r;
  try { r = await api.get(code); } catch (e) { r = { ok: false, err: e && e.message }; }
  if (!r || !r.ok || !r.data) return toast((r && r.err) || 'No song has that code', 3500);
  let p;
  try {
    const o = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    if (!o || typeof o !== 'object' || !(Array.isArray(o.ch) || o.simple)) throw new Error('not a Beat Lab song');
    p = o.mode === 'simple' ? { mode: 'simple', simple: o.simple } : Object.assign(E.fromSave(o), { mode: 'studio' });
  } catch (e) { return toast('That code\'s song could not be opened (' + e.message + ')', 4000); }
  p.id = uid(); p.name = (r.name || 'Shared song') + (r.by ? ' (by ' + r.by + ')' : '');
  closeModal(); openProjectObj(p); Store.save(A.p);
  modal('Opened "' + A.p.name + '"', h('p', null, 'This is your own copy: change it as much as you like. Press Play to hear it.'),
    [{ t: 'Download...', f: () => { setTimeout(downloadDialog, 30); } }, { t: 'Play', primary: true, f: () => { A.eng.audio(); if (!A.playing) togglePlay(); } }]);
}
// ---- downloads: the song as audio, just the drums or the melody, or the project file
function downloadDialog() {
  const row = (t, d, f) => h('button', { class: 'dl-opt', onclick: () => { closeModal(); setTimeout(f, 30); } }, h('b', null, t), h('span', null, d));
  modal('Download "' + A.p.name + '"', h('div', { class: 'dl-list' },
    row('Song as audio (WAV)', 'A sound file you can play anywhere or put in a video.', () => exportWav(false)),
    row('Just the drums (WAV)', 'Only the drum and percussion channels.', () => exportWav(false, 'drums')),
    row('Just the melody (WAV)', 'Everything except the drums.', () => exportWav(false, 'melody')),
    row('Project file (.json)', 'Open it later in Beat Lab (Projects, "Import") or give it to a friend.', () => exportProject(A.p))), [{ t: 'Close' }]);
  A.ui.dlg = 'download';
}
// mute every channel that is not in the stem (drum channels = drum voices)
function stemProject(proj, stem) {
  const p = E.clone(proj); let n = 0;
  const used = id => p.pat.some(q => (q.st[id] || []).some(v => v > 0) || (q.nt[id] || []).length);
  for (const c of p.ch) { const drum = c.s && c.s.k === 'drm', keep = stem === 'drums' ? drum : !drum; c.solo = 0; if (!keep) c.mute = 1; else if (!c.mute && used(c.id)) n++; }
  return n ? p : null;
}

// ---- your song as the launcher's music: the launcher plays the project named in beatlab_launcher on its own pages, with
// Beat Lab's engine (Beat Lab/engine.js, loaded only when needed). The key syncs with the account like the songs do.
function launcherMusic() {
  if (isTemp()) return modal('Launcher music', h('p', null, 'This is a practice song from a lesson, so it is not saved yet. Keep it as one of your songs first, then it can be your launcher music.'),
    [{ t: 'Cancel' }, { t: 'Keep this song', primary: true, f: () => { tutKeep(); setTimeout(launcherMusic, 30); } }]);
  const cur = (() => { try { return localStorage.getItem('beatlab_launcher'); } catch (e) { return null; } })();
  const mine = cur === A.p.id;
  const tell = () => { try { if (parent !== window && parent.HG_musicChanged) parent.HG_musicChanged(); } catch (e) {} };
  modal('Launcher music', h('p', null, mine ? '"' + A.p.name + '" is your launcher music. It plays on the launcher\'s pages (never over a game).' :
    'Play "' + A.p.name + '" on the launcher\'s pages instead of the shop track? It never plays over a game, and the music button on the launcher still turns it off.'),
    mine ? [{ t: 'Keep it' }, { t: 'Stop using it', f: () => { try { localStorage.removeItem('beatlab_launcher'); } catch (e) {} tell(); toast('The launcher plays the shop track again.'); } }]
         : [{ t: 'Cancel' }, { t: 'Use this song', primary: true, f: () => { saveNow(); try { localStorage.setItem('beatlab_launcher', A.p.id); } catch (e) {} tell(); toast('Done: it plays when you go back to the launcher.'); } }]);
}
