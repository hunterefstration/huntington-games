
// ===== Launcher music: the track you wear (bought in the Goon Shop) plays on the launcher's pages =====
// Original tracks made right here with Web Audio (no files): 'tidal' (fast, bright, 140 bpm) and 'nightdrive'
// (synthwave, 100 bpm). Never over a game: it stops while one is open and comes back after. The first press anywhere
// on the page starts it (browsers do not allow sound before that).
var MUS = { ac: null, gain: null, track: '', next: 0, step: 0, timer: 0, on: false };
var TRACKS = {
  tidal: { bpm: 140, root: 52, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],   // E minor: i VI III VII
    lead: [12, -1, 15, -1, 19, 17, 15, -1, 12, -1, 10, 12, -1, 15, 14, -1] },
  nightdrive: { bpm: 100, root: 57, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 7]],   // A minor: i VI III VII
    lead: [7, -1, -1, 10, -1, 12, -1, -1, 15, -1, 14, -1, 12, -1, 10, -1] }
};
function musFreq(n) { return 440 * Math.pow(2, (n - 69) / 12); }
function musTone(t, f, dur, type, vol, cut) {
  var ac = MUS.ac, o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
  o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut || 4000;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(MUS.gain); o.start(t); o.stop(t + dur + 0.05);
}
function musNoise(t, dur, vol, hp) {
  var ac = MUS.ac, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(MUS.gain); s.start(t);
}
function musKick(t) { var ac = MUS.ac, o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(MUS.gain); o.start(t); o.stop(t + 0.32); }
function musBeat(tr, s, t) {
  var T = TRACKS[tr], sd = 60 / T.bpm / 4, bar = Math.floor(s / 16) % 4, i = s % 16, ch = T.prog[bar], r = T.root;
  if (tr === 'tidal') {
    if (i % 4 === 0) musKick(t); if (i % 4 === 2) musNoise(t, 0.05, 0.18, 7000); if (i === 4 || i === 12) musNoise(t, 0.16, 0.35, 1500);
    if (i % 2 === 0) musTone(t, musFreq(r - 24 + ch[0]), sd * 1.8, 'sawtooth', 0.22, 600);
    musTone(t, musFreq(r + 12 + ch[i % 3] + (i % 6 > 2 ? 12 : 0)), sd * 0.9, 'square', 0.05, 2600);
    var l = T.lead[i]; if (l >= 0 && bar % 2 === 1) musTone(t, musFreq(r + l), sd * 1.8, 'triangle', 0.12, 5000);
  } else {
    if (i === 0 || i === 10) musKick(t); if (i === 4 || i === 12) musNoise(t, 0.22, 0.3, 1200); if (i % 2 === 1) musNoise(t, 0.04, 0.1, 8000);
    if (i % 8 === 0) ch.forEach(function (n) { musTone(t, musFreq(r + n), sd * 7.5, 'sawtooth', 0.045, 1400); });
    if (i % 2 === 0) musTone(t, musFreq(r - 24 + ch[0] + (i % 4 === 2 ? 12 : 0)), sd * 1.6, 'square', 0.12, 500);
    var l2 = T.lead[i]; if (l2 >= 0 && bar >= 2) musTone(t, musFreq(r + 12 + l2), sd * 2.6, 'triangle', 0.1, 3500);
  }
}
function musTick() {
  if (!MUS.on || !MUS.track) return;
  var T = TRACKS[MUS.track], sd = 60 / T.bpm / 4;
  while (MUS.next < MUS.ac.currentTime + 0.25) { musBeat(MUS.track, MUS.step, MUS.next); MUS.next += sd; MUS.step++; }
}
function musWant() {
  var L = window.HGGrapevine, e = L && L.eco && L.eco.state(), id = e && e.equip && e.equip.music;
  var tr = id ? id.replace(/^music:/, '') : '';
  return TRACKS[tr] && !document.documentElement.classList.contains('playing') && !document.hidden && musPref() ? tr : '';
}
function musPref() { try { return localStorage.getItem('hgv:music') !== 'off'; } catch (e) { return true; } }
function musSync() {
  var want = musWant();
  if (want && !MUS.ac) { try { MUS.ac = new (window.AudioContext || window.webkitAudioContext)(); MUS.gain = MUS.ac.createGain(); MUS.gain.gain.value = 0.35; MUS.gain.connect(MUS.ac.destination); } catch (e) { return; } }
  if (!MUS.ac) return;
  if (want && (!MUS.on || MUS.track !== want)) { MUS.track = want; MUS.on = true; MUS.step = 0; MUS.next = MUS.ac.currentTime + 0.1; if (MUS.ac.state === 'suspended') MUS.ac.resume(); clearInterval(MUS.timer); MUS.timer = setInterval(musTick, 90); }
  else if (!want && MUS.on) { MUS.on = false; clearInterval(MUS.timer); MUS.gain.gain.setTargetAtTime(0.0001, MUS.ac.currentTime, 0.1); setTimeout(function () { if (!MUS.on) MUS.gain.gain.value = 0.35; }, 600); }
}
setInterval(musSync, 1000);
document.addEventListener('pointerdown', function () { if (MUS.ac && MUS.ac.state === 'suspended') MUS.ac.resume(); musSync(); }, { capture: true });
window.HG_music = { toggle: function () { try { localStorage.setItem('hgv:music', musPref() ? 'off' : 'on'); } catch (e) {} musSync(); return musPref(); }, playing: function () { return MUS.on ? MUS.track : ''; } };
