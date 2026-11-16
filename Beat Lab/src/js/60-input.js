// ===== Playing and recording: computer keyboard as a piano (FL layout), Web MIDI, record with count-in + quantize =====
const KEYMAP = {};
['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM', 'Comma', 'KeyL', 'Period', 'Semicolon', 'Slash'].forEach((c, i) => KEYMAP[c] = i);
['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU', 'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP'].forEach((c, i) => KEYMAP[c] = 12 + i);
const IN = { held: new Map(), rec: new Map(), midi: null };
function typingNoteDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') { A.set.oct = clamp(A.set.oct + (e.code === 'BracketLeft' ? -1 : 1), 1, 7); Store.saveSet(); toast('Keyboard octave: C' + A.set.oct, 900); return true; }
  const k = KEYMAP[e.code]; if (k == null) return false;
  if (e.repeat || IN.held.has(e.code)) return true;
  const m = 12 * (A.set.oct + 1) + k;
  IN.held.set(e.code, m);
  liveNoteOn(m, 0.8);
  return true;
}
function typingNoteUp(e) {
  const m = IN.held.get(e.code); if (m == null) return;
  IN.held.delete(e.code);
  liveNoteOff(m);
}
function liveNoteOn(m, vel) {
  const c = curCh(); if (!c) return;
  A.eng.noteOn(c.id, m, vel);
  if (A.ui.rec && A.playing) { const pos = A.eng.position(); if (pos != null && pos > -STEP) IN.rec.set(m, { pos: Math.max(0, pos), vel, ch: c.id }); }
  if (A.ui.tab === 'roll') { RL.keyDown = m; A.views.roll.dirty = true; }
}
function liveNoteOff(m) {
  const c = curCh(); if (!c) return;
  A.eng.noteOff(c.id, m);
  const r = IN.rec.get(m);
  if (r) { IN.rec.delete(m); const pos = A.eng.position(); addRecorded(r, m, pos == null ? r.pos + STEP : pos); }
  if (RL.keyDown === m) { RL.keyDown = null; if (A.views.roll) A.views.roll.dirty = true; }
}
function addRecorded(r, m, endPos) {
  const q = curPat(), len = q.len * STEP, ch = chById(r.ch); if (!ch) return;
  const qz = A.set.recQ | 0;
  if (endPos < r.pos) endPos += len;                 // the loop wrapped while the key was held
  let t = r.pos % len, d = Math.max(3, endPos - r.pos);
  if (qz > 0) { t = Math.round(t / qz) * qz; d = Math.max(qz, Math.round(d / qz) * qz); if (t >= len) t -= len; }
  (q.nt[ch.id] = q.nt[ch.id] || []).push([Math.round(t), Math.round(Math.min(d, len)), m, Math.round(clamp(r.vel, 0.05, 1) * 127)]);
  if (q.st[ch.id]) delete q.st[ch.id];                // a channel with piano-roll notes stops using its steps
  changed();
}
function toggleRecord() {
  if (A.ui.rec) { stopPlay(); return; }
  const c = curCh(); if (!c) return toast('Add a channel to record into first');
  if (A.playing) stopPlay();
  if (A.ui.playMode !== 'pat') setPlayMode('pat');
  Hist.begin();
  A.ui.rec = true; IN.rec.clear();
  ST.rec.classList.add('on'); document.body.classList.add('recording');
  startPlay(A.set.countIn ? 1 : 0);
  toast('Recording into "' + c.n + '" in ' + curPat().n + (A.set.countIn ? ' after one bar of clicks' : '') + '. Play with your keyboard or MIDI; Space stops.', 3500);
}
function finishRecording() {
  if (!A.ui.rec) return;
  const pos = A.eng.position();
  for (const [m, r] of IN.rec) addRecorded(r, m, pos == null ? r.pos + STEP : pos);
  IN.rec.clear();
  A.ui.rec = false;
  if (ST.rec) ST.rec.classList.remove('on');
  document.body.classList.remove('recording');
  Hist.end('Record');
}
function recordTick(pos) { if (ST.rec) ST.rec.classList.toggle('blink', pos == null || pos < 0); }
function connectMidi() {
  if (!navigator.requestMIDIAccess) return toast('This browser has no MIDI support. The computer keyboard works as a piano: Z S X D C... and Q 2 W 3 E...', 4000);
  if (IN.midi) return toast('MIDI is on: ' + (IN.midiNames || 'no keyboard found yet'), 2500);
  navigator.requestMIDIAccess().then(acc => {
    IN.midi = acc;
    const hook = () => {
      const names = [];
      acc.inputs.forEach(inp => { names.push(inp.name); inp.onmidimessage = midiMsg; });
      IN.midiNames = names.join(', ');
      return names;
    };
    acc.onstatechange = hook;
    const n = hook();
    toast(n.length ? 'MIDI keyboard ready: ' + n.join(', ') : 'MIDI is on. Plug in a keyboard and it will be used.', 3000);
  }, () => toast('MIDI is blocked here (the browser or the page Beat Lab runs in did not allow it). The computer keyboard still works as a piano.', 4500));
}
function midiMsg(ev) {
  if (!A.p || A.p.mode !== 'studio') return;
  const [st, d1, d2] = ev.data, cmd = st & 0xf0;
  if (cmd === 0x90 && d2 > 0) liveNoteOn(d1, d2 / 127);
  else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) liveNoteOff(d1);
}
