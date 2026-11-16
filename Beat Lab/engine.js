// Beat Lab engine, built from Beat Lab/src/js/10-engine.js, 11-engine-dsp.js, 12-engine-fx.js, 13-engine-voice.js, 14-engine-presets.js, 15-engine-demos.js, 16-engine-simple.js by tools/check.js --fix. Do not edit.
// =====================================================================================================================
// BEAT LAB ENGINE: plays Beat Lab projects with Web Audio. Everything is synthesised (no samples, no network).
// The engine is the files 10-engine.js .. 16-engine-simple.js. They use no DOM and nothing from the rest of Beat Lab,
// so another page (the launcher's music player) can paste them in, in name order, and get globalThis.BeatLabEngine.
// Playing a player's song from the launcher:
//   const p = BeatLabEngine.fromSave(localStorage.getItem('beatlab_p_' + id));   // simple songs are converted
//   const eng = BeatLabEngine.create(); eng.audio(); eng.load(p); eng.play({ mode: 'song' });   ... eng.destroy()
//
// API (E = BeatLabEngine)
//   const eng = E.create({ ctx, out })    a live engine (out: an AudioNode of ctx to play into instead of the speakers). ctx: an AudioContext (made on the first eng.audio() call if left
//                                         out; browsers only allow sound after a click, so call eng.audio() from one)
//   eng.load(project)                     use this project; call it again after every change (it only rebuilds what
//                                         changed, and running playback picks the change up)
//   eng.play({ mode, pat, from, countIn }) mode 'song' (the playlist) or 'pat' (loop pattern id `pat`); from: tick;
//                                         countIn: bars of metronome first
//   eng.stop(), eng.seek(tick), eng.playing, eng.position()  (ticks; PPQ 48, so a 16th-note step is 12 ticks)
//   eng.noteOn(chId, midi, vel0to1) / eng.noteOff(chId, midi)   play a channel live; eng.preview(params, midi)
//   eng.stats {notes, voices}, eng.onError(fn), eng.destroy()
//   E.render(project, { mode, pat, loops, tail, sampleRate, onProgress }) -> Promise<AudioBuffer>  (OfflineAudioContext)
//   E.toWav(audioBuffer) -> ArrayBuffer (16-bit PCM WAV)
//   E.songTicks(project), E.patTicks(pattern), E.barTicks(project), E.normalize(project) (fills defaults, migrates)
//   E.PRESETS [{id, n: name, c: category, p: params}], E.preset(id) -> params, E.DEMOS [{id, n, make() -> project}]
//   E.fromSave(savedJsonOrObject) -> project, E.fromSimple(simpleSong, name) -> project, E.addChannel(project, presetId)
//   Saves: one project per localStorage key beatlab_p_<id>; { mode: 'simple', simple: {...} } or a studio project.
//
// Project format (version 1, plain JSON; times in ticks, 48 per quarter note):
//   { v: 1, id, name, bpm, sig: [beats, unit], swing: 0..100, key: 0..11, scale: 'minor',
//     ch:  [{ id, n: name, col: '#rrggbb', p: presetId, s: params (see 13-engine-voice.js), mix: mixer track,
//             vol: 0..1 (0.8 = unity), pan: -1..1, mute, solo, root: midi note the step sequencer plays }],
//     pat: [{ id, n: name, len: steps, st: { chId: [velocity 0-127 per step] }, nt: { chId: [[tick, len, midi, vel 1-127, art]] },
//             sa: { chId: [articulation per step, 0 or '' = normal] } (optional) }],
//            art (optional, absent = normal; 2026-11-16) is how the note is played, one of E.ARTS:
//              'acc' accent (louder, brighter)  'stac' staccato (short, detached)  'slide' legato (glides from the
//              previous note's pitch on that channel)  'vib' vibrato  'soft' ghost note  'bend' bends up into the note
//              'fall' falls off at the end  'flam' a grace hit just before  'roll' repeated fast hits (drum roll / tremolo)
//     pl:  { tr: [{ n: name, mute }], cl: [[patId, track, startStep, lengthSteps]] },
//     mix: [{ n, vol, pan, mute, solo, out: track it feeds (0 = master), snd: [track, amount] | null,
//             fx: [{ t: 'eq'|'filter'|'comp'|'dist'|'crush'|'delay'|'reverb'|'chorus'|'phaser'|'limit', on: 1, p: {...} }] }]
//            mix[0] is the master (also has lim: 1 for its brick-wall limiter),
//     loop: [startStep, endStep] | null }
// =====================================================================================================================
const BeatLabEngine = (globalThis.BeatLabEngine = globalThis.BeatLabEngine || {});
(function (E) {
  'use strict';
  const PPQ = 48, STEP = 12;
  E.PPQ = PPQ; E.STEP = STEP; E.VERSION = 1;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  E.mtof = mtof;
  // note values for tempo-synced delays and LFOs, in beats
  E.SYNC = { '4/1': 16, '2/1': 8, '1/1': 4, '1/2': 2, '1/2.': 3, '1/4': 1, '1/4.': 1.5, '1/4T': 2 / 3, '1/8': 0.5, '1/8.': 0.75, '1/8T': 1 / 3, '1/16': 0.25, '1/16T': 1 / 6, '1/32': 0.125 };
  const volGain = v => v * v * 1.5625;                  // fader 0..1 -> gain, 0.8 = unity
  E.volGain = volGain;
  // articulations: id, name, marker glyph, colour, drums (offered in drum lanes / step sequencer)
  E.ARTS = [
    { id: 'acc', n: 'Accent', g: '>', col: '#ff4d4f', d: 1 }, { id: 'stac', n: 'Staccato', g: '•', col: '#228be6' },
    { id: 'slide', n: 'Slide', g: '/', col: '#7950f2' }, { id: 'vib', n: 'Vibrato', g: '~', col: '#12b886' },
    { id: 'soft', n: 'Soft', g: 'p', col: '#868e96', d: 1 }, { id: 'bend', n: 'Bend up', g: '↗', col: '#f76707' },
    { id: 'fall', n: 'Fall', g: '↘', col: '#e8590c' }, { id: 'flam', n: 'Flam', g: 'ƒ', col: '#d6336c', d: 1 },
    { id: 'roll', n: 'Roll', g: '≡', col: '#ae3ec9', d: 1 }];
  E.ART = {}; for (const a of E.ARTS) E.ART[a.id] = a;
  E.lastError = '';
  const errs = [];
  function report(where, e) {
    E.lastError = where + ': ' + (e && e.message || e);
    for (const f of errs) try { f(E.lastError); } catch (x) {}
  }
  E.report = report;

  // ---------------------------------------------------------------- project helpers
  E.barTicks = p => Math.round((p.sig ? p.sig[0] : 4) * PPQ * 4 / (p.sig ? p.sig[1] : 4));
  E.patTicks = pat => Math.max(1, pat.len | 0) * STEP;
  E.songTicks = function (p) {
    let end = 0;
    for (const c of (p.pl && p.pl.cl) || []) end = Math.max(end, (c[2] + c[3]) * STEP);
    const bar = E.barTicks(p);
    return Math.max(bar, Math.ceil(end / bar) * bar);
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  E.clone = clone;
  // deep-fill defaults: every key of def missing in o is copied in (objects recursively)
  function fill(o, def) {
    if (!o || typeof o !== 'object') return clone(def);
    for (const k in def) {
      const d = def[k];
      if (o[k] === undefined || o[k] === null && d !== null) o[k] = d && typeof d === 'object' && !Array.isArray(d) ? clone(d) : (Array.isArray(d) ? d.slice() : d);
      else if (d && typeof d === 'object' && !Array.isArray(d) && typeof o[k] === 'object') fill(o[k], d);
    }
    return o;
  }
  E.fill = fill;
  E.TRACK_DEFAULT = { n: 'Insert', vol: 0.8, pan: 0, mute: 0, solo: 0, out: 0, snd: null, fx: [] };
  E.newMixer = function (n) {
    const m = [{ n: 'Master', vol: 0.8, pan: 0, mute: 0, solo: 0, out: -1, snd: null, fx: [], lim: 1 }];
    for (let i = 1; i <= (n || 8); i++) m.push(Object.assign(clone(E.TRACK_DEFAULT), { n: 'Insert ' + i }));
    return m;
  };
  // Fill defaults and migrate older saves so every field the engine reads is there.
  E.normalize = function (p) {
    p = p && typeof p === 'object' ? p : {};
    p.v = 1;
    p.bpm = Math.min(300, Math.max(30, +p.bpm || 120));
    if (!Array.isArray(p.sig) || p.sig.length !== 2) p.sig = [4, 4];
    p.swing = Math.min(100, Math.max(0, +p.swing || 0));
    if (p.key == null) p.key = 0;
    if (!p.scale) p.scale = 'minor';
    p.ch = Array.isArray(p.ch) ? p.ch : [];
    p.ch.forEach((c, i) => {
      if (c.id == null) c.id = i + 1;
      fill(c, { n: 'Channel', col: '#5fb3ff', p: '', mix: 0, vol: 0.8, pan: 0, mute: 0, solo: 0, root: 60 });
      c.s = E.normParams(c.s || (c.p && E.preset(c.p)) || null);
    });
    p.pat = Array.isArray(p.pat) && p.pat.length ? p.pat : [{ id: 1, n: 'Pattern 1', len: 16, st: {}, nt: {} }];
    p.pat.forEach((q, i) => { if (q.id == null) q.id = i + 1; fill(q, { n: 'Pattern ' + (i + 1), len: 16, st: {}, nt: {} }); });
    p.pl = p.pl && typeof p.pl === 'object' ? p.pl : {};
    if (!Array.isArray(p.pl.tr) || !p.pl.tr.length) p.pl.tr = Array.from({ length: 16 }, (_, i) => ({ n: 'Track ' + (i + 1), mute: 0 }));
    if (!Array.isArray(p.pl.cl)) p.pl.cl = [];
    if (!Array.isArray(p.mix) || !p.mix.length) p.mix = E.newMixer(8);
    p.mix.forEach((m, i) => { fill(m, E.TRACK_DEFAULT); if (i === 0) { m.out = -1; if (m.lim == null) m.lim = 1; } m.fx.forEach(f => { if (f.on == null) f.on = 1; f.p = fill(f.p || {}, E.fxDefaults(f.t)); }); });
    p.ch.forEach(c => { if (c.mix >= p.mix.length) c.mix = 0; });
    if (p.loop && !(Array.isArray(p.loop) && p.loop[1] > p.loop[0])) p.loop = null;
    return p;
  };

  // ---------------------------------------------------------------- compile notes into a sorted event list
  // event: { t: tick, d: length in ticks, c: channel id, n: midi, v: 0..1, sw: on an off-beat 16th (gets swing) }
  function patEvents(p, pat) {
    const out = [], len = E.patTicks(pat);
    for (const ch of p.ch) {
      const st = pat.st && pat.st[ch.id];
      const sa = pat.sa && pat.sa[ch.id];
      if (st) for (let i = 0, n = Math.min(st.length, pat.len); i < n; i++) if (st[i] > 0) { const e = { t: i * STEP, d: STEP, c: ch.id, n: ch.root || 60, v: st[i] / 127, sw: i & 1 }; if (sa && sa[i] && E.ART[sa[i]]) e.a = sa[i]; out.push(e); }
      const nt = pat.nt && pat.nt[ch.id];
      if (nt) {
        for (const n of nt) if (n[0] < len) {
          const e = { t: n[0], d: Math.max(1, n[1]), c: ch.id, n: n[2], v: (n[3] || 100) / 127, sw: n[0] % 24 === 12 ? 1 : 0 };
          if (n[4] && E.ART[n[4]]) {
            e.a = n[4];
            if (e.a === 'slide') {                  // the pitch it glides from: the latest note before it on this channel
              let pf = null, pt = -1; for (const m of nt) if (m[0] < n[0] && m[0] >= pt) { pt = m[0]; pf = m[2]; }
              e.f = pf == null ? n[2] - 2 : pf;
            }
          }
          out.push(e);
        }
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  function songEvents(p) {
    const out = [], byId = new Map(p.pat.map(x => [x.id, x])), cache = new Map();
    for (const cl of p.pl.cl) {
      const pid = cl[0], tr = p.pl.tr[cl[1]];
      if (tr && tr.mute) continue;
      const pat = byId.get(pid); if (!pat) continue;
      let ev = cache.get(pid); if (!ev) { ev = patEvents(p, pat); cache.set(pid, ev); }
      const plen = E.patTicks(pat), start = cl[2] * STEP, end = (cl[2] + cl[3]) * STEP;
      for (let off = 0; start + off < end; off += plen) for (const e of ev) {
        const t = start + off + e.t; if (t >= end) break;
        const o = { t, d: Math.min(e.d, end - t), c: e.c, n: e.n, v: e.v, sw: e.sw }; if (e.a) { o.a = e.a; if (e.f != null) o.f = e.f; }
        out.push(o);
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  E.compile = function (p, mode, patId) {
    if (mode === 'song') {
      const len = E.songTicks(p), loop = p.loop ? [p.loop[0] * STEP, p.loop[1] * STEP] : [0, len];
      return { ev: songEvents(p), a: loop[0], b: loop[1], len };
    }
    const pat = p.pat.find(x => x.id === patId) || p.pat[0];
    const len = E.patTicks(pat);
    return { ev: patEvents(p, pat), a: 0, b: len, len, pat: pat.id };
  };
  function firstAt(ev, t) { let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < t) lo = m + 1; else hi = m; } return lo; }

  // param setter: jump the first time (and offline), glide after so knob moves do not click
  function sp(param, v, ctx) {
    if (!isFinite(v) || param.__v === v) return;
    if (param.__v === undefined || !ctx || ctx.state !== 'running') { param.cancelScheduledValues(0); param.value = v; }
    else param.setTargetAtTime(v, ctx.currentTime, 0.015);
    param.__v = v;
  }
  E.sp = sp;

  // =================================================================================================== the engine
  function Engine(ctx, opts) {
    this.ctx = ctx || null; this.offline = !!(opts && opts.offline); this.out = (opts && opts.out) || null;      // out: an AudioNode to play into (the launcher's music volume)
    this.proj = null; this.ch = new Map(); this.mix = []; this.voices = [];
    this.playing = false; this.mode = 'pat'; this.patId = null; this.metro = false;
    this.stats = { notes: 0, voices: 0, recent: [] };
    this.lookahead = 0.12; this._virt = 0; this.dirty = true; this.plan = null;
    this.maxVoices = this.offline ? 160 : 56;
    this.chokes = new Map(); this.held = new Map();
    if (this.ctx) this._init();
  }
  const P = Engine.prototype;
  E.create = (o) => new Engine(o && o.ctx, o);
  E.Engine = Engine;
  P.onError = function (f) { errs.push(f); };
  P.audio = function () {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this._init();
    }
    if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume().catch(() => {});
    return this.ctx;
  };
  P._init = function () {
    const ctx = this.ctx;
    E.fx.prepare(ctx).then(ok => { if (ok && this.proj) { this.mix.forEach(t => t.fsig = ''); this._syncMixer(); } });
    if (!this.offline) {
      this._timer = setInterval(() => { try { this._schedule(); this._gc(); } catch (e) { report('scheduler', e); } }, 25);
    }
    if (this.proj) this.load(this.proj);
  };
  P.now = function () { return this.ctx.currentTime + this._virt; };
  P.destroy = function () {
    this.stop(); clearInterval(this._timer);
    if (this.ctx && !this.offline && this.ctx.close) this.ctx.close().catch(() => {});
    this.ctx = null;
  };

  // ---------------------------------------------------------------- load / sync a project
  P.load = function (p) {
    this.proj = p; this.dirty = true;
    if (!this.ctx) return;
    try { this._syncMixer(); this._syncChannels(); } catch (e) { report('load', e); }
  };
  P.spt = function () { return 60 / ((this.proj ? this.proj.bpm : 120) * PPQ); };

  P._makeTrack = function (i) {
    const ctx = this.ctx, t = { i, input: ctx.createGain(), fx: [], fsig: null, vol: ctx.createGain(), an: ctx.createAnalyser(), pan: null, lim: null, out: undefined, snd: null };
    t.an.fftSize = 256; t.an.smoothingTimeConstant = 0;
    if (i === 0) {
      t.lim = ctx.createDynamicsCompressor();
      t.lim.threshold.value = -1.5; t.lim.knee.value = 0; t.lim.ratio.value = 20; t.lim.attack.value = 0.002; t.lim.release.value = 0.12;
      t.post = ctx.createGain();
      // last stage: a soft clipper, so even a transient the limiter misses never goes past full scale
      const clip = ctx.createWaveShaper(), n = 2048, cv = new Float32Array(n);
      for (let k = 0; k < n; k++) { const x = k / (n - 1) * 2 - 1, a = Math.abs(x); cv[k] = Math.sign(x) * (a < 0.85 ? a : 0.85 + 0.13 * Math.tanh((a - 0.85) / 0.13)); }
      clip.curve = cv;
      t.vol.connect(t.post); if (E.noClip) t.post.connect(t.an); else { t.post.connect(clip); clip.connect(t.an); } t.an.connect(this.out && this.out.context === ctx ? this.out : ctx.destination);
    } else {
      t.pan = ctx.createStereoPanner();
      t.pan.connect(t.vol); t.vol.connect(t.an);
    }
    t.input.connect(i === 0 ? t.vol : t.pan);
    return t;
  };
  P._chainFx = function (t, m) {
    const head = t.i === 0 ? t.vol : t.pan;
    try { t.input.disconnect(); } catch (e) {}
    for (const f of t.fx) if (f) { try { f.output.disconnect(); } catch (e) {} f.dispose && f.dispose(); }
    t.fx = [];
    let prev = t.input;
    m.fx.forEach(fd => {
      let f = null;
      if (fd.on && E.FX[fd.t]) { try { f = E.FX[fd.t].make(this.ctx, this); prev.connect(f.input); prev = f.output; } catch (e) { report('fx ' + fd.t, e); f = null; } }
      t.fx.push(f);
    });
    prev.connect(head);
  };
  P._syncMixer = function () {
    const p = this.proj, ctx = this.ctx;
    while (this.mix.length < p.mix.length) this.mix.push(this._makeTrack(this.mix.length));
    while (this.mix.length > p.mix.length) {
      const t = this.mix.pop();
      for (const n of [t.input, t.vol, t.an, t.pan]) try { n && n.disconnect(); } catch (e) {}
      if (t.sndG) try { t.sndG.disconnect(); } catch (e) {}
    }
    const anySolo = p.mix.some((m, i) => i > 0 && m.solo);
    p.mix.forEach((m, i) => {
      const t = this.mix[i];
      const fsig = m.fx.map(f => f.t + (f.on ? '' : '-')).join(',') + (E.fx.workletOk(ctx) ? '+' : '');
      if (fsig !== t.fsig) { this._chainFx(t, m); t.fsig = fsig; }
      t.fx.forEach((f, j) => { if (f) try { f.set(m.fx[j].p, this); } catch (e) { report('fx set', e); } });
      const muted = m.mute || (i > 0 && anySolo && !m.solo);
      sp(t.vol.gain, muted ? 0 : volGain(m.vol), ctx);
      if (i === 0) {
        const lim = !!m.lim;
        if (lim !== t.limOn) {
          try { t.vol.disconnect(); t.lim.disconnect(); } catch (e) {}
          if (lim) { t.vol.connect(t.lim); t.lim.connect(t.post); } else t.vol.connect(t.post);
          t.limOn = lim;
        }
        return;
      }
      sp(t.pan.pan, m.pan || 0, ctx);
      // where it goes: master, or another insert as long as that never leads back here
      let out = m.out | 0;
      if (out < 0 || out >= p.mix.length || out === i) out = 0;
      for (let k = out, n = 0; k > 0 && n < 40; k = p.mix[k].out | 0, n++) if (k === i) { out = 0; break; }
      if (out !== t.out) { try { t.an.disconnect(); } catch (e) {} t.an.connect(this.mix[out].input); t.out = out; t.snd = null; }
      const snd = m.snd && m.snd[0] > 0 && m.snd[0] < p.mix.length && m.snd[0] !== i && m.snd[0] !== out ? m.snd : null;
      const sk = snd ? snd[0] : 0;
      if (sk !== t.snd) {
        if (t.sndG) { try { t.sndG.disconnect(); t.vol.disconnect(t.sndG); } catch (e) {} t.sndG = null; }
        if (sk) { let loop = false; for (let k = sk, n = 0; k > 0 && n < 40; k = p.mix[k].out | 0, n++) if (k === i) loop = true;
          if (!loop) { t.sndG = ctx.createGain(); t.vol.connect(t.sndG); t.sndG.connect(this.mix[sk].input); } }
        t.snd = sk;
      }
      if (t.sndG) sp(t.sndG.gain, snd ? snd[1] : 0, ctx);
    });
  };

  P._makeChan = function (id) {
    const ctx = this.ctx, c = { id, input: ctx.createGain(), trem: ctx.createGain(), vol: ctx.createGain(), pan: ctx.createStereoPanner(), sig: null, route: null, voices: [], held: new Map(), buf: null, bkey: '' };
    c.trem.connect(c.vol); c.vol.connect(c.pan);
    return c;
  };
  // channel chain: voices -> input -> [drive] -> [vowel formants] -> trem (LFO amp) -> vol -> pan -> mixer track
  P._chainChan = function (c, s) {
    const ctx = this.ctx;
    try { c.input.disconnect(); } catch (e) {}
    for (const n of c.extra || []) try { n.disconnect(); } catch (e) {}
    if (c.lfo) { try { c.lfo.stop(); c.lfo.disconnect(); c.lfoG.disconnect(); } catch (e) {} c.lfo = c.lfoG = null; }
    c.extra = [];
    let prev = c.input;
    if (s.k === 'syn' && s.drive > 0) {
      // tanh with a gain of sqrt(k): saturates loud notes, keeps typical levels about where they were
      const ws = ctx.createWaveShaper(), k = 1 + s.drive * 24, n = 1024, cv = new Float32Array(n), norm = Math.sqrt(k);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(x * k) / norm; }
      ws.curve = cv; ws.oversample = '2x';
      const g = ctx.createGain(); g.gain.value = 1;
      prev.connect(ws); ws.connect(g); prev = g; c.extra.push(ws, g);
    }
    if (s.k === 'syn' && s.vowel && E.VOWELS[s.vowel]) {
      const sum = ctx.createGain(); sum.gain.value = 1;
      const dry = ctx.createGain(); dry.gain.value = 0.15; prev.connect(dry); dry.connect(sum); c.extra.push(sum, dry);
      E.VOWELS[s.vowel].forEach(([f, g, bw]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = f / bw;
        const gg = ctx.createGain(); gg.gain.value = g * 4; prev.connect(bp); bp.connect(gg); gg.connect(sum); c.extra.push(bp, gg);
      });
      prev = sum;
    }
    prev.connect(c.trem);
    const lfo = s.k === 'syn' && s.lfo && s.lfo.tgt !== 'off' && s.lfo.amt > 0 ? s.lfo : null;
    sp(c.trem.gain, 1, null);
    if (lfo) {
      c.lfo = ctx.createOscillator(); c.lfo.type = lfo.w || 'sine'; c.lfoG = ctx.createGain();
      c.lfo.connect(c.lfoG); c.lfo.start();
      if (lfo.tgt === 'amp') { c.trem.gain.cancelScheduledValues(0); c.trem.gain.value = 1 - Math.min(1, lfo.amt) * 0.5; c.trem.gain.__v = undefined; c.lfoG.connect(c.trem.gain); }
    }
    c.lfoTgt = lfo ? lfo.tgt : 'off';
  };
  P._syncChannels = function () {
    const p = this.proj, seen = new Set();
    const anySolo = p.ch.some(c => c.solo);
    for (const d of p.ch) {
      seen.add(d.id);
      let c = this.ch.get(d.id);
      if (!c) { c = this._makeChan(d.id); this.ch.set(d.id, c); }
      this._syncChan(c, d, anySolo);
    }
    for (const [id, c] of this.ch) if (!seen.has(id) && id !== '__pv') { this._killChan(c); this.ch.delete(id); }
    if (this.ch.has('__pv')) this._syncChan(this.ch.get('__pv'), this.ch.get('__pv').data, false);
  };
  P._syncChan = function (c, d, anySolo) {
    const ctx = this.ctx, s = d.s;
    c.data = d; c.s = s;
    const lfo = s.lfo || {};
    const sig = s.k + '|' + (s.k === 'syn' && s.drive > 0 ? s.drive : 0) + '|' + (s.vowel || '') + '|' + (s.k === 'syn' && lfo.amt > 0 ? lfo.tgt + lfo.w + (lfo.tgt === 'amp' ? Math.min(1, lfo.amt).toFixed(2) : '') : 'off');
    if (sig !== c.sig) { this._chainChan(c, s); c.sig = sig; }
    c.muted = !!(d.mute || (anySolo && !d.solo));
    sp(c.vol.gain, c.muted ? 0 : volGain(d.vol), ctx);
    sp(c.pan.pan, d.pan || 0, ctx);
    if (c.lfo) {
      const rate = lfo.sync && E.SYNC[lfo.sync] ? (this.proj.bpm / 60) / E.SYNC[lfo.sync] : lfo.r;
      sp(c.lfo.frequency, Math.max(0.01, rate), ctx);
      const depth = lfo.tgt === 'pitch' ? lfo.amt * 100 : lfo.tgt === 'filter' ? lfo.amt * 2400 : Math.min(1, lfo.amt) * 0.5;
      sp(c.lfoG.gain, depth, ctx);
    }
    const tr = this.mix[d.mix] || this.mix[0];
    if (tr && c.route !== tr) { try { c.pan.disconnect(); } catch (e) {} c.pan.connect(tr.input); c.route = tr; }
    if (s.k === 'drm') { const k = JSON.stringify(s.d); if (k !== c.bkey) { c.bkey = k; c.buf = null; } }
  };
  P._killChan = function (c) {
    for (const v of c.voices) E.voiceKill(this, v, this.ctx.currentTime);
    try { c.pan.disconnect(); } catch (e) {}
    if (c.lfo) try { c.lfo.stop(); } catch (e) {}
  };

  // ---------------------------------------------------------------- notes
  // art: an articulation id (E.ARTS), from: the midi note a slide starts at
  P._fire = function (chId, midi, vel, t, dur, art, from) {
    const c = this.ch.get(chId);
    if (!c || !c.s) return null;
    if (c.muted && chId !== '__pv' && dur != null) return null;
    let x = null;
    if (art && dur != null) {
      const now = this.ctx.currentTime;
      switch (art) {
        case 'acc': x = { amp: 1.45, bright: 1 }; vel = Math.min(1, vel * 1.15 + 0.05); break;
        case 'soft': x = { amp: 0.5 }; vel *= 0.6; break;
        case 'stac': dur = Math.max(0.03, Math.min(dur * 0.4, 0.22)); x = { rel: 0.04 }; break;
        case 'slide': x = { from: from == null ? midi - 2 : from, gt: Math.min(0.12, dur * 0.5) }; break;
        case 'vib': x = { vib: 1 }; break;
        case 'bend': x = { from: midi - 2, gt: Math.min(0.25, dur * 0.6), bend: 1 }; break;
        case 'fall': x = { fall: Math.max(0.06, dur * 0.5) }; break;
        case 'flam': if (t - 0.035 >= now) this._fire(chId, midi, vel * 0.55, t - 0.035, Math.min(dur, 0.06)); break;
        case 'roll': {                        // 32nd notes across the note's length
          const iv = Math.max(0.035, this.spt() * 6), n = Math.max(2, Math.min(32, Math.round(dur / iv)));
          for (let k = 1; k < n; k++) this._fire(chId, midi, vel * (k % 2 ? 0.72 : 0.85), t + k * iv, iv * 0.9);
          dur = iv * 0.9;
          break;
        }
      }
    }
    let v = null;
    try { v = E.voiceStart(this, c, midi, vel, t, dur, x); } catch (e) { report('note', e); }
    if (v) {
      this.stats.notes++;
      const r = this.stats.recent; r.push([chId, midi, t]); if (r.length > 32) r.shift();
      this.voices.push(v); c.voices.push(v);
      if (this.voices.length > this.maxVoices) {             // too many at once: let the oldest go
        const old = this.voices.find(x => !x.dead && x !== v);
        if (old) E.voiceKill(this, old, t);
      }
    }
    return v;
  };
  P._gc = function () {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!this.voices.length) return;
    const keep = [];
    for (const v of this.voices) { if (v.end < now - 0.05) { E.voiceFree(this, v); } else keep.push(v); }
    if (keep.length !== this.voices.length) {
      this.voices = keep;
      for (const c of this.ch.values()) if (c.voices.length) c.voices = c.voices.filter(v => !v.freed);
    }
    this.stats.voices = keep.length;
  };
  P.noteOn = function (chId, midi, vel) {
    if (!this.ctx) this.audio();
    const c = this.ch.get(chId); if (!c) return;
    const k = chId + ':' + midi;
    if (this.held.has(k)) this.noteOff(chId, midi);
    const v = this._fire(chId, midi, vel == null ? 0.8 : vel, this.ctx.currentTime + 0.005, null);
    if (v) this.held.set(k, v);
  };
  P.noteOff = function (chId, midi) {
    const k = chId + ':' + midi, v = this.held.get(k);
    if (v) { E.voiceRelease(this, v, this.ctx.currentTime); this.held.delete(k); }
  };
  P.hit = function (chId, midi, vel, dur, art) {     // one short note on a project channel, now (art: an articulation)
    this.audio();
    return this._fire(chId, midi, vel == null ? 0.8 : vel, this.ctx.currentTime + (art === 'flam' ? 0.04 : 0.005), dur == null ? 0.3 : dur, art);
  };
  P.allOff = function () {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.voices) E.voiceKill(this, v, t);
    this.held.clear();
  };
  // play a sound without a project channel (preset browser): params = synth/drum params
  P.preview = function (params, midi, vel, dur) {
    this.audio();
    let c = this.ch.get('__pv');
    if (!c) { c = this._makeChan('__pv'); this.ch.set('__pv', c); }
    this._syncChan(c, { id: '__pv', s: params, vol: 0.8, pan: 0, mix: 0 }, false);
    for (const v of c.voices) E.voiceKill(this, v, this.ctx.currentTime);
    return this._fire('__pv', midi == null ? 60 : midi, vel == null ? 0.85 : vel, this.ctx.currentTime + 0.01, dur == null ? 0.6 : dur);
  };

  // ---------------------------------------------------------------- transport: look-ahead scheduler on the audio clock
  P.play = function (o) {
    o = o || {};
    if (!this.proj) return;
    this.audio();
    this.stop();
    this.mode = o.mode === 'song' ? 'song' : 'pat';
    this.patId = o.pat != null ? o.pat : (this.proj.pat[0] && this.proj.pat[0].id);
    this._recompile();
    const from = Math.max(this.plan.a, Math.min(this.plan.b - 1, o.from || 0)) || this.plan.a;
    const pre = (o.countIn | 0) * E.barTicks(this.proj);
    this.segTime = this.now() + 0.06; this.segTick = from - pre; this.cursor = from - pre;
    this.prevSeg = null;
    this.ei = firstAt(this.plan.ev, from);
    this.countIn = pre > 0;
    this.playing = true;
    this._schedule();
  };
  P.stop = function () {
    if (!this.playing) return;
    this.playing = false;
    if (this.ctx) { const t = this.ctx.currentTime; for (const v of this.voices) if (!v.live) E.voiceRelease(this, v, t, 0.03); }
  };
  P.seek = function (tick) {
    if (!this.playing) return;
    this._recompile();
    tick = Math.max(this.plan.a, Math.min(this.plan.b - 1, tick));
    this.segTime = this.now() + 0.03; this.segTick = tick; this.cursor = tick; this.prevSeg = null;
    this.ei = firstAt(this.plan.ev, tick);
  };
  P.setMode = function (mode, patId) {           // switch what plays without stopping
    this.mode = mode; if (patId != null) this.patId = patId; this.dirty = true;
  };
  P._recompile = function () {
    this.plan = E.compile(this.proj, this.mode, this.patId);
    this.dirty = false;
    if (this.playing) {
      if (this.cursor >= this.plan.b && !this.countIn) {          // the loop got shorter than where we are: wrap now
        this.segTime = this.segTime + (this.cursor - this.segTick) * this.spt(); this.segTick = this.plan.a; this.cursor = this.plan.a;
      }
      this.ei = firstAt(this.plan.ev, Math.max(this.cursor, this.plan.a));
    }
  };
  P.position = function () {
    if (!this.playing || !this.ctx) return null;
    const spt = this.spt(), now = this.now() - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    if (now < this.segTime && this.prevSeg) return this.prevSeg.tick + (now - this.prevSeg.time) / spt;
    return this.segTick + (now - this.segTime) / spt;
  };
  P._schedule = function () {
    if (!this.playing || !this.proj) return;
    if (this.dirty) this._recompile();
    if (this._bpm !== this.proj.bpm) {                          // tempo changed: carry on from the cursor at the new speed
      if (this._bpm) { const oldSpt = 60 / (this._bpm * PPQ); this.segTime = this.segTime + (this.cursor - this.segTick) * oldSpt; this.segTick = this.cursor; }
      this._bpm = this.proj.bpm;
    }
    const spt = this.spt(), horizon = this.now() + this.lookahead, plan = this.plan, ev = plan.ev;
    const swingT = (this.proj.swing / 100) * STEP * 0.66;
    for (let guard = 0; guard < 16; guard++) {
      const reach = this.segTick + (horizon - this.segTime) / spt;
      const upto = Math.min(reach, plan.b);
      if (this.cursor < upto) {
        this._metro(this.cursor, upto, spt);
        if (this.cursor >= plan.a || this.cursor >= 0) {
          while (this.ei < ev.length && ev[this.ei].t < upto) {
            const e = ev[this.ei++];
            if (e.t < this.cursor) continue;
            const tt = e.t + (e.sw ? swingT : 0);
            const time = this.segTime + (tt - this.segTick) * spt;
            if (time < this.ctx.currentTime + this._virt - 0.02) continue;     // too late (tab was asleep)
            this._fire(e.c, e.n, e.v, time - this._virt, e.d * spt, e.a, e.f);
          }
        }
        this.cursor = upto;
      }
      if (reach >= plan.b && plan.b > plan.a) {
        this.prevSeg = { tick: this.segTick, time: this.segTime };
        this.segTime = this.segTime + (plan.b - this.segTick) * spt;
        this.segTick = plan.a; this.cursor = plan.a; this.countIn = false;
        this.ei = firstAt(ev, plan.a);
        if (this.onLoop) try { this.onLoop(); } catch (e) {}
      } else break;
    }
    if (this.countIn && this.cursor >= 0) this.countIn = false;
  };
  P._metro = function (from, to, spt) {
    if (!this.metro && !(this.countIn && from < 0)) return;
    const beat = PPQ * 4 / this.proj.sig[1], bar = E.barTicks(this.proj);
    for (let b = Math.ceil(from / beat) * beat; b < to; b += beat) {
      if (!this.metro && b >= 0) break;
      const time = this.segTime + (b - this.segTick) * spt - this._virt;
      if (time < this.ctx.currentTime) continue;
      E.click(this, time, ((b % bar) + bar) % bar === 0);
    }
  };
  // tests: pretend `sec` seconds passed and run the scheduler (works with a suspended AudioContext too)
  P.step = function (sec) {
    const n = Math.max(1, Math.round(sec / 0.025));
    for (let i = 0; i < n; i++) { this._virt += 0.025; this._schedule(); }
  };

  // =================================================================================================== offline render
  E.render = async function (proj, o) {
    o = o || {};
    const p = E.normalize(clone(proj));
    const sr = o.sampleRate || 44100, mode = o.mode === 'pat' ? 'pat' : 'song';
    const plan = E.compile(p, mode, o.pat);
    const spt = 60 / (p.bpm * PPQ);
    let ev = plan.ev, endTick = plan.len;
    if (mode === 'song') { if (o.from != null || o.to != null) { const a = o.from || 0, b = o.to || plan.len; ev = ev.filter(e => e.t >= a && e.t < b).map(e => Object.assign({}, e, { t: e.t - a })); endTick = b - a; } }
    else {
      const loops = Math.max(1, o.loops | 0 || 1), out = [];
      for (let k = 0; k < loops; k++) for (const e of plan.ev) out.push(Object.assign({}, e, { t: e.t + k * plan.len }));
      ev = out; endTick = plan.len * loops;
    }
    const tail = o.tail == null ? 2.5 : o.tail;
    const dur = endTick * spt + tail;
    if (dur > 900) throw new Error('That is longer than 15 minutes: too long to export in one go.');
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
    await E.fx.prepare(ctx);
    const eng = new Engine(ctx, { offline: true });
    eng.load(p);
    const swingT = (p.swing / 100) * STEP * 0.66;
    const times = ev.map(e => (e.t + (e.sw ? swingT : 0)) * spt + 0.02);
    let i = 0;
    const until = tEnd => { for (; i < ev.length && times[i] < tEnd; i++) eng._fire(ev[i].c, ev[i].n, ev[i].v, times[i], ev[i].d * spt, ev[i].a, ev[i].f); };
    const CH = 2;                                                   // seconds of notes set up at a time
    until(CH * 2);
    const marks = [];
    for (let s = CH; s < dur; s += CH) marks.push(s);
    for (const s of marks) ctx.suspend(s).then(() => {
      until(s + CH * 2); eng._gcOffline(s);
      if (o.onProgress) try { o.onProgress(s / dur); } catch (e) {}
      ctx.resume();
    });
    const buf = await ctx.startRendering();
    if (o.onProgress) try { o.onProgress(1); } catch (e) {}
    return buf;
  };
  P._gcOffline = function (now) {
    this.voices = this.voices.filter(v => { if (v.end < now - 0.05) { E.voiceFree(this, v); return false; } return true; });
    for (const c of this.ch.values()) c.voices = c.voices.filter(v => !v.freed);
  };
  // 16-bit PCM WAV
  E.toWav = function (buf) {
    const nch = Math.min(2, buf.numberOfChannels), len = buf.length, sr = buf.sampleRate;
    const out = new ArrayBuffer(44 + len * nch * 2), dv = new DataView(out);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + len * nch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nch, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * nch * 2, true); dv.setUint16(32, nch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, len * nch * 2, true);
    const chs = []; for (let c = 0; c < nch; c++) chs.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < nch; c++) { let s = chs[c][i]; s = s < -1 ? -1 : s > 1 ? 1 : s; dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    return out;
  };
  E.bufferStats = function (buf) {
    let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 4) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; } }
    return { peak, rms: Math.sqrt(sum / Math.max(1, n)), seconds: buf.duration };
  };
})(BeatLabEngine);

// Beat Lab engine, part 2: sounds computed in plain JavaScript into buffers, once, then cached. Drums, Karplus-Strong
// plucked strings, modal (struck/bowed bar, bell, piano string) tones and reverb impulse responses. A buffer costs one
// BufferSource node to play, the cheapest thing Web Audio can do, and sounds the same live and in a WAV export.
(function (E) {
  'use strict';
  const D = E.dsp = {};
  const TAU = Math.PI * 2;
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  D.rng = rng;
  // RBJ biquad over a whole buffer (in place)
  function biquad(x, type, f, q, sr, gainDb) {
    f = Math.min(f, sr * 0.45);
    const w = TAU * f / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * (q || 0.707)), A = Math.pow(10, (gainDb || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }   // peak
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const xi = x[i], y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y; }
    return x;
  }
  D.biquad = biquad;
  function normalize(x, peak) { let m = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; } if (m > 0) { const g = (peak || 0.95) / m; for (let i = 0; i < x.length; i++) x[i] *= g; } return x; }
  function fadeOut(x, n) { n = Math.min(n, x.length); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; }
  function drive(x, amt) { if (amt <= 0) return x; const k = 1 + amt * 10, nk = Math.tanh(k); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) / nk; return x; }
  function crush(x, amt, sr) {
    if (amt <= 0) return x;
    const bits = Math.round(16 - amt * 11), step = Math.pow(0.5, bits - 1), hold = 1 + Math.round(amt * 5);
    let h = 0;
    for (let i = 0; i < x.length; i++) { if (i % hold === 0) h = Math.round(x[i] / step) * step; x[i] = h; }
    return biquad(x, 'lp', 14000 - amt * 9000, 0.7, sr);
  }
  // six detuned square waves: the classic metallic hat/cymbal source
  const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
  function metal(n, sr, mul, r) {
    const out = new Float32Array(n), ph = METAL.map(() => r());
    for (let k = 0; k < METAL.length; k++) { const inc = METAL[k] * mul / sr; let p = ph[k]; for (let i = 0; i < n; i++) { p += inc; if (p >= 1) p -= 1; out[i] += p < 0.5 ? 1 : -1; } }
    return out;
  }
  function noise(n, r) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = r() * 2 - 1; return o; }
  const tun = t => Math.pow(2, (t || 0) / 12);

  // ------------------------------------------------------------------------------------------ drums
  // d: { type, tune (semitones), dec (decay x), tone 0..1, snap 0..1, drive 0..1, crush 0..1 }
  D.DRUM_TYPES = ['kick', 'snare', 'clap', 'hat', 'ohat', 'cymbal', 'ride', 'tom', 'rim', 'cowbell', 'clave', 'shaker', 'tamb', 'conga', 'bongo', 'block', 'triangle', 'agogo', 'snap', 'timpani', 'zap', 'impact', 'revcym', 'chipkick', 'chipsnare', 'chiphat', 'vinyl', 'brush', 'sroll', 'gong'];
  D.drum = function (d, sr) {
    const r = rng(1234 + (D.DRUM_TYPES.indexOf(d.type) + 1) * 97);
    const T = tun(d.tune), dec = Math.max(0.05, d.dec == null ? 1 : d.dec), tone = d.tone == null ? 0.5 : d.tone, snap = d.snap == null ? 0.5 : d.snap;
    const mk = s => new Float32Array(Math.max(64, Math.ceil(s * sr)));
    let x;
    switch (d.type) {
      case 'kick': {
        const ad = 0.32 * dec, f0 = 52 * T, f1 = f0 * (2.2 + snap * 6), pt = 0.025 + 0.05 * (1 - tone);
        x = mk(Math.min(6, ad * 7 + 0.02));
        let ph = 0;
        for (let i = 0; i < x.length; i++) { const t = i / sr, f = f0 + (f1 - f0) * Math.exp(-t / pt); ph += TAU * f / sr; const env = Math.min(1, t / 0.0015) * Math.exp(-t / ad); x[i] = Math.sin(ph) * env; }
        if (snap > 0) { const c = biquad(noise(Math.ceil(0.012 * sr), r), 'hp', 900 + tone * 3000, 0.8, sr); for (let i = 0; i < c.length; i++) x[i] += c[i] * Math.exp(-i / sr / 0.003) * snap * 0.55; }
        break;
      }
      case 'snare': case 'brush': {
        const len = 0.35 * dec + 0.05; x = mk(len);
        const f1 = 185 * T, f2 = 330 * T, td = 0.055 * dec, nd = (d.type === 'brush' ? 0.16 : 0.13) * dec;
        let p1 = 0, p2 = 0;
        const nz = biquad(biquad(noise(x.length, r), 'hp', 1200 + tone * 2500, 0.7, sr), 'lp', 7000 + tone * 6000, 0.7, sr);
        for (let i = 0; i < x.length; i++) {
          const t = i / sr, bend = 1 + 0.25 * Math.exp(-t / 0.01);
          p1 += TAU * f1 * bend / sr; p2 += TAU * f2 * bend / sr;
          const body = (Math.sin(p1) * 0.7 + Math.sin(p2) * 0.4) * Math.exp(-t / td) * (1 - snap * 0.6);
          const ne = d.type === 'brush' ? Math.min(1, t / 0.012) * Math.exp(-t / nd) : Math.exp(-t / nd);
          x[i] = body + nz[i] * ne * (0.4 + snap * 0.9);
        }
        break;
      }
      case 'clap': {
        const tail = 0.18 * dec; x = mk(0.05 + tail * 6);
        const nz = biquad(biquad(noise(x.length, r), 'bp', (900 + tone * 1200) * T, 1.4, sr), 'hp', 500, 0.7, sr);
        const bursts = [0, 0.011, 0.021, 0.031 + snap * 0.004];
        for (let i = 0; i < x.length; i++) {
          const t = i / sr; let e = 0;
          for (let b = 0; b < bursts.length - 1; b++) if (t >= bursts[b]) e = Math.max(e, Math.exp(-(t - bursts[b]) / 0.0045));
          const lb = bursts[3]; if (t >= lb) e = Math.max(e, Math.exp(-(t - lb) / tail));
          x[i] = nz[i] * e;
        }
        break;
      }
      case 'hat': case 'ohat': case 'cymbal': case 'ride': {
        const open = d.type === 'ohat', cym = d.type === 'cymbal', ride = d.type === 'ride';
        const dd = (cym ? 1.6 : ride ? 1.2 : open ? 0.32 : 0.045) * dec;
        x = mk(Math.min(8, dd * 6 + 0.01));
        const m = metal(x.length, sr, T * (cym ? 1.18 : ride ? 1.05 : 1), r), nz = noise(x.length, r);
        const mixN = cym ? 0.5 + tone * 0.3 : tone * 0.6;
        for (let i = 0; i < x.length; i++) x[i] = m[i] * (1 - mixN) + nz[i] * mixN * 1.2;
        biquad(x, 'bp', (cym ? 8000 : 10000) * Math.sqrt(T), 0.9, sr); biquad(x, 'hp', cym || ride ? 4500 : 7000, 0.7, sr);
        for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] *= Math.min(1, t / 0.0008) * Math.exp(-t / dd) * (open ? 1 : 1) ; }
        if (ride) { let p1 = 0, p2 = 0; for (let i = 0; i < x.length; i++) { const t = i / sr; p1 += TAU * 3400 * T / sr; p2 += TAU * 5100 * T / sr; x[i] += (Math.sin(p1) + 0.6 * Math.sin(p2)) * 0.12 * (0.5 + snap) * Math.exp(-t / (0.5 * dec)); } }
        break;
      }
      case 'tom': case 'timpani': {
        const timp = d.type === 'timpani', f0 = (timp ? 90 : 110) * T, ad = (timp ? 1.4 : 0.3) * dec;
        x = mk(ad * 6); let p1 = 0, p2 = 0, p3 = 0;
        for (let i = 0; i < x.length; i++) {
          const t = i / sr, f = f0 * (1 + (timp ? 0.12 : 0.55) * Math.exp(-t / (timp ? 0.08 : 0.04)));
          p1 += TAU * f / sr; p2 += TAU * f * 1.5 / sr; p3 += TAU * f * (timp ? 1.99 : 2.44) / sr;
          x[i] = (Math.sin(p1) + Math.sin(p2) * 0.35 * Math.exp(-t / (ad * 0.4)) + Math.sin(p3) * 0.2 * Math.exp(-t / (ad * 0.25))) * Math.min(1, t / 0.002) * Math.exp(-t / ad);
        }
        const nz = biquad(noise(Math.ceil(0.03 * sr), r), timp ? 'lp' : 'bp', timp ? 900 : 2500, 0.9, sr);
        for (let i = 0; i < nz.length; i++) x[i] += nz[i] * Math.exp(-i / sr / 0.006) * (0.2 + snap * 0.5);
        break;
      }
      case 'rim': {
        x = mk(0.08 * dec + 0.03); let p1 = 0, p2 = 0;
        for (let i = 0; i < x.length; i++) { const t = i / sr; p1 += TAU * 1700 * T / sr; p2 += TAU * 480 * T / sr; x[i] = (Math.sin(p1) * 0.7 + Math.sin(p2) * 0.6) * Math.exp(-t / (0.011 * dec)); }
        const nz = biquad(noise(Math.ceil(0.01 * sr), r), 'bp', 3000 + tone * 3000, 1, sr);
        for (let i = 0; i < nz.length; i++) x[i] += nz[i] * Math.exp(-i / sr / 0.002) * snap;
        break;
      }
      case 'cowbell': case 'agogo': {
        const ag = d.type === 'agogo', a = (ag ? 920 : 587) * T, b = (ag ? 1400 : 845) * T, dd = (ag ? 0.35 : 0.22) * dec;
        x = mk(dd * 6); let pa = 0, pb = 0;
        for (let i = 0; i < x.length; i++) { const t = i / sr; pa += a / sr; pb += b / sr; pa %= 1; pb %= 1; const sq = (pa < 0.5 ? 1 : -1) + (pb < 0.5 ? 1 : -1) * 0.8; const e = t < 0.01 ? 1 : 0.35 + 0.65 * Math.exp(-(t - 0.01) / 0.02); x[i] = sq * e * Math.exp(-t / dd); }
        biquad(x, 'bp', (ag ? 2200 : 2640) * T, 1.6, sr);
        break;
      }
      case 'clave': case 'block': {
        const f = (d.type === 'clave' ? 2500 : 800 + tone * 900) * T, dd = (d.type === 'clave' ? 0.03 : 0.022) * dec;
        x = mk(dd * 7 + 0.01); let p = 0, p2 = 0;
        for (let i = 0; i < x.length; i++) { const t = i / sr; p += TAU * f / sr; p2 += TAU * f * 2.7 / sr; x[i] = (Math.sin(p) + (d.type === 'block' ? 0.4 * Math.sin(p2) : 0)) * Math.exp(-t / dd); }
        break;
      }
      case 'shaker': case 'tamb': {
        const tb = d.type === 'tamb', dd = (tb ? 0.16 : 0.07) * dec, att = tb ? 0.002 : 0.012 + (1 - snap) * 0.02;
        x = mk(att + dd * 6);
        const nz = biquad(noise(x.length, r), 'hp', (tb ? 6000 : 5000) + tone * 3000, 0.7, sr);
        for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] = nz[i] * (t < att ? t / att : Math.exp(-(t - att) / dd)); }
        if (tb) { const jf = [5100, 6500, 7900, 9300]; for (const f of jf) { let p = r(); const inc = f * T / sr; for (let i = 0; i < x.length; i++) { p += inc; x[i] += Math.sin(p * TAU) * 0.15 * Math.exp(-i / sr / (dd * 1.2)); } } }
        break;
      }
      case 'conga': case 'bongo': {
        const f0 = (d.type === 'bongo' ? 400 : 220) * T, dd = (d.type === 'bongo' ? 0.12 : 0.22) * dec;
        x = mk(dd * 6); let p1 = 0, p2 = 0, p3 = 0;
        for (let i = 0; i < x.length; i++) { const t = i / sr, f = f0 * (1 + 0.06 * Math.exp(-t / 0.02)); p1 += TAU * f / sr; p2 += TAU * f * 1.59 / sr; p3 += TAU * f * 2.14 / sr; x[i] = (Math.sin(p1) + 0.3 * Math.sin(p2) * Math.exp(-t / (dd * 0.4)) + 0.15 * Math.sin(p3) * Math.exp(-t / (dd * 0.2))) * Math.exp(-t / dd); }
        const nz = biquad(noise(Math.ceil(0.015 * sr), r), 'bp', 1800, 1, sr);
        for (let i = 0; i < nz.length; i++) x[i] += nz[i] * Math.exp(-i / sr / 0.003) * snap * 0.8;
        break;
      }
      case 'triangle': {
        const dd = 1.2 * dec; x = mk(dd * 5); const fs = [1250, 3440, 5870, 7900];
        fs.forEach((f, k) => { let p = 0; const inc = TAU * f * T / sr; for (let i = 0; i < x.length; i++) { p += inc; x[i] += Math.sin(p) * [1, 0.5, 0.35, 0.2][k] * Math.exp(-i / sr / (dd / (1 + k * 0.5))); } });
        break;
      }
      case 'snap': {
        x = mk(0.15 * dec + 0.02);
        const nz = biquad(noise(x.length, r), 'bp', 2200 * T, 2.2, sr);
        for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] = nz[i] * (Math.exp(-t / 0.004) + 0.3 * Math.exp(-t / (0.03 * dec))); }
        break;
      }
      case 'zap': {
        const dd = 0.18 * dec; x = mk(dd * 3); let p = 0;
        for (let i = 0; i < x.length; i++) { const t = i / sr, f = 80 * T + 2400 * T * Math.exp(-t / (dd * 0.3)); p += TAU * f / sr; x[i] = Math.sin(p) * Math.exp(-t / dd) * (tone > 0.5 ? Math.sign(Math.sin(p)) * 0.5 + 0.5 : 1); }
        break;
      }
      case 'impact': {
        const dd = 1.1 * dec; x = mk(dd * 5); let p = 0;
        const nz = biquad(noise(x.length, r), 'lp', 600 + tone * 2400, 0.7, sr);
        for (let i = 0; i < x.length; i++) { const t = i / sr, f = 30 * T + 70 * T * Math.exp(-t / 0.15); p += TAU * f / sr; x[i] = (Math.sin(p) + nz[i] * 0.6 * Math.exp(-t / (dd * 0.4))) * Math.exp(-t / dd); }
        break;
      }
      case 'revcym': {
        const c = D.drum({ type: 'cymbal', tune: d.tune, dec: 1.2 * dec, tone, snap }, sr), n = Math.min(c.length, Math.ceil(2.2 * dec * sr));
        x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = c[n - 1 - i];
        break;
      }
      case 'chipkick': {
        x = mk(0.18 * dec + 0.02); let p = 0;
        for (let i = 0; i < x.length; i++) { const t = i / sr, f = 40 * T + 300 * T * Math.exp(-t / 0.03); p += f / sr; x[i] = ((p % 1) < 0.5 ? 1 : -1) * Math.exp(-t / (0.06 * dec)); }
        break;
      }
      case 'chipsnare': case 'chiphat': {
        const hat = d.type === 'chiphat', dd = (hat ? 0.03 : 0.1) * dec; x = mk(dd * 6);
        let lfsr = 0x7fff, hold = 0, v = 1; const per = Math.max(1, Math.round(sr / ((hat ? 18000 : 7000) * T)));
        for (let i = 0; i < x.length; i++) { if (hold-- <= 0) { const bit = (lfsr ^ (lfsr >> (tone > 0.6 ? 6 : 1))) & 1; lfsr = (lfsr >> 1) | (bit << 14); v = lfsr & 1 ? 1 : -1; hold = per; } x[i] = v * Math.exp(-i / sr / dd); }
        break;
      }
      case 'vinyl': {
        x = mk(2 * dec); const nz = biquad(noise(x.length, r), 'bp', 3000, 0.5, sr);
        for (let i = 0; i < x.length; i++) x[i] = nz[i] * 0.05 + (r() < 0.0009 ? (r() - 0.5) * 1.6 : 0);
        biquad(x, 'lp', 6000, 0.7, sr); fadeOut(x, 400);
        break;
      }
      case 'sroll': {                             // orchestral snare roll: fast strokes on a rattling snare, swelling then fading
        const len = 1.1 * dec; x = mk(len + 0.15);
        const nz = biquad(biquad(noise(x.length, r), 'hp', 1500 + tone * 2000, 0.7, sr), 'lp', 8000 + tone * 4000, 0.7, sr);
        const rate = 26 + snap * 10;
        for (let i = 0; i < x.length; i++) {
          const t = i / sr, ph = (t * rate) % 1, stroke = Math.exp(-ph / 0.18) * (0.75 + 0.25 * Math.sin(t * 7.3));
          const sw = t < len ? 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t / len) * 0.9) : Math.exp(-(t - len) / 0.04);
          x[i] = nz[i] * (0.35 + stroke * 0.65) * sw;
        }
        break;
      }
      case 'gong': {                              // tam-tam: low inharmonic partials that bloom and ring
        const dd = 2.6 * dec; x = mk(Math.min(8, dd * 2.5));
        const fs = [92, 131, 187, 243, 311, 398, 517].map(f => f * T), ph = fs.map(() => r() * TAU);
        for (let i = 0; i < x.length; i++) {
          const t = i / sr, bloom = Math.min(1, t / 0.25); let v = 0;
          for (let k = 0; k < fs.length; k++) v += Math.sin(ph[k] + TAU * fs[k] * t * (1 + 0.002 * Math.sin(t * 3 + k))) * Math.exp(-t / (dd * (1 - k * 0.09))) * (k < 2 ? 1 : 0.35 + bloom * 0.4);
          x[i] = v * Math.min(1, t / 0.004);
        }
        break;
      }
      default: x = mk(0.1);
    }
    drive(x, d.drive || 0);
    crush(x, d.crush || 0, sr);
    fadeOut(x, Math.min(256, x.length >> 2));
    return normalize(x, 0.95);
  };

  // ------------------------------------------------------------------------------------------ Karplus-Strong pluck
  // ks: { damp 0..1 (darker, shorter), bright 0..1 (pick brightness), dur seconds, pos 0..1 pick position }
  D.pluck = function (freq, sr, ks) {
    const damp = ks.damp == null ? 0.4 : ks.damp, bright = ks.bright == null ? 0.6 : ks.bright;
    const t60 = Math.max(0.2, (ks.dur || 3) * Math.pow(261 / freq, 0.35) * (1.3 - damp));
    const len = Math.ceil(Math.min(t60 * 1.1, 6) * sr), out = new Float32Array(len);
    const lpk = 0.5 - damp * 0.3;                               // loop filter: brighter strings use less averaging
    const s = lpk;                                              // ...and it delays the loop by lpk samples
    const P = sr / freq, L = Math.max(2, Math.floor(P - s - 0.05)), fd = P - L - s, C = (1 - fd) / (1 + fd);
    const g = Math.pow(0.001, 1 / (t60 * freq));                // loss per trip so the note dies away in t60
    const r = rng(Math.round(freq * 7));
    const buf = new Float32Array(L);
    let lp = 0; const a = 0.15 + bright * 0.85;
    for (let i = 0; i < L; i++) { lp += a * ((r() * 2 - 1) - lp); buf[i] = lp; }
    const pos = Math.max(1, Math.round((ks.pos == null ? 0.13 : ks.pos) * L));    // pick position: comb out some partials
    const ex = buf.slice(); for (let i = 0; i < L; i++) buf[i] = ex[i] - 0.9 * ex[(i + pos) % L];
    let m = 0; for (let i = 0; i < L; i++) m = Math.max(m, Math.abs(buf[i])); if (m) for (let i = 0; i < L; i++) buf[i] /= m;
    let idx = 0, prev = 0, apX = 0, apY = 0;
    for (let n = 0; n < len; n++) {
      const cur = buf[idx];
      out[n] = cur;
      const avg = (1 - lpk) * cur + lpk * prev; prev = cur;
      const y = C * avg + apX - C * apY; apX = avg; apY = y;     // first-order allpass: fine tuning
      buf[idx] = y * g;
      idx++; if (idx >= L) idx = 0;
    }
    let dc = 0, dcx = 0; for (let n = 0; n < len; n++) { const v = out[n] - dcx + 0.995 * dc; dcx = out[n]; dc = v; out[n] = v; }
    fadeOut(out, Math.min(2000, len >> 3));
    return normalize(out, 0.9);
  };

  // ------------------------------------------------------------------------------------------ modal tones
  // A recipe is a list of partials [ratio, amp, decay seconds at middle C] plus how they behave: inh (string
  // stiffness: ratios stretch like a piano's), n (harmonic partials 1..n generated from roll/dec), beat (cents
  // of slow beating), hammer (attack noise), att (attack seconds), keyDec (how much faster high notes die).
  D.MODAL = {
    piano: { n: 22, roll: 1.05, dec: 3.2, decN: 0.12, inh: 0.00035, beat: 0.6, hammer: 0.08, keyDec: 0.55, two: 0.3, max: 6 },
    brightpiano: { n: 26, roll: 0.82, dec: 2.8, decN: 0.1, inh: 0.0004, beat: 0.9, hammer: 0.12, keyDec: 0.55, two: 0.3, max: 6 },
    felt: { n: 12, roll: 1.6, dec: 2.6, decN: 0.2, inh: 0.0003, beat: 0.4, hammer: 0.03, keyDec: 0.5, two: 0.35, att: 0.004, max: 5 },
    upright: { n: 18, roll: 1.1, dec: 2.2, decN: 0.15, inh: 0.0005, beat: 2.2, hammer: 0.1, keyDec: 0.6, two: 0.25, max: 5 },
    toypiano: { p: [[1, 1, 0.9], [2.01, 0.15, 0.4], [3.95, 0.35, 0.25], [9.2, 0.12, 0.08]], hammer: 0.05, keyDec: 0.4, max: 2.5 },
    epiano: { p: [[1, 1, 2.4], [2, 0.22, 1.2], [3, 0.06, 0.6], [7.1, 0.16, 0.12], [14.3, 0.05, 0.05]], hammer: 0.02, keyDec: 0.5, beat: 0.3, max: 4 },
    marimba: { p: [[1, 1, 0.7], [3.93, 0.32, 0.22], [9.25, 0.08, 0.06]], hammer: 0.05, keyDec: 0.6, max: 2.5 },
    xylo: { p: [[1, 1, 0.35], [3.0, 0.45, 0.15], [6.07, 0.2, 0.07], [9.8, 0.06, 0.04]], hammer: 0.08, keyDec: 0.45, max: 1.5 },
    vibes: { p: [[1, 1, 3.2], [4.0, 0.2, 1.1], [10.0, 0.06, 0.3]], hammer: 0.02, keyDec: 0.35, max: 5 },
    glock: { p: [[1, 1, 2.6], [2.76, 0.3, 1.4], [5.4, 0.18, 0.7], [8.93, 0.08, 0.35]], hammer: 0.04, keyDec: 0.3, max: 4 },
    celesta: { p: [[1, 1, 1.6], [4.0, 0.12, 0.4], [10.0, 0.04, 0.12]], hammer: 0.03, keyDec: 0.4, max: 3 },
    musicbox: { p: [[1, 1, 1.8], [5.4, 0.25, 0.5], [15.6, 0.05, 0.12], [2.0, 0.08, 0.9]], hammer: 0.04, keyDec: 0.3, max: 3 },
    tubular: { p: [[1, 0.6, 4], [2.76, 0.4, 3], [5.4, 0.8, 2.6], [8.93, 0.5, 1.8], [13.34, 0.3, 1.2], [18.64, 0.15, 0.8]], hammer: 0.04, keyDec: 0.2, max: 6 },
    bell: { p: [[0.5, 0.4, 5], [1, 1, 3.5], [1.19, 0.5, 2.6], [1.5, 0.35, 2.2], [2, 0.6, 1.8], [2.52, 0.25, 1.3], [3.0, 0.2, 1], [4.2, 0.12, 0.7]], hammer: 0.03, keyDec: 0.25, beat: 1.5, max: 7 },
    kalimba: { p: [[1, 1, 1.4], [5.9, 0.18, 0.18], [13.1, 0.06, 0.06]], hammer: 0.06, keyDec: 0.45, max: 3 },
    steeldrum: { p: [[1, 1, 1.4], [2, 0.5, 0.9], [3, 0.25, 0.5], [4.02, 0.15, 0.3], [1.5, 0.1, 0.3]], hammer: 0.03, keyDec: 0.4, att: 0.004, max: 3 },
    handpan: { p: [[1, 1, 2.6], [2, 0.45, 1.6], [2.99, 0.25, 1.2], [0.5, 0.12, 2]], hammer: 0.03, keyDec: 0.35, beat: 2, att: 0.003, max: 5 },
    gamelan: { p: [[1, 1, 3], [2.31, 0.5, 2], [3.71, 0.3, 1.2], [5.12, 0.2, 0.7]], hammer: 0.05, keyDec: 0.3, beat: 6, max: 6 },
    crystal: { p: [[1, 1, 2.8], [2.32, 0.35, 1.6], [4.25, 0.25, 0.9], [6.63, 0.15, 0.5]], hammer: 0.01, keyDec: 0.3, beat: 1, att: 0.002, max: 5 },
    harp: { n: 10, roll: 1.4, dec: 2.4, decN: 0.25, inh: 0.0001, beat: 0, hammer: 0.02, keyDec: 0.45, max: 4 },
    clav: { n: 24, roll: 0.75, dec: 1.2, decN: 0.05, inh: 0.0002, beat: 0, hammer: 0.08, keyDec: 0.4, comb: 0.18, max: 2.5 }
  };
  D.modal = function (freq, sr, name) {
    const R = D.MODAL[name] || D.MODAL.piano, r = rng(Math.round(freq * 13) + name.length);
    const keyF = Math.pow(261.6 / freq, R.keyDec == null ? 0.5 : R.keyDec);
    let parts = R.p ? R.p.map(q => q.slice()) : [];
    if (!R.p) {
      for (let n = 1; n <= R.n; n++) {
        const comb = R.comb ? Math.abs(Math.sin(Math.PI * n * R.comb)) : 1;
        parts.push([n * Math.sqrt(1 + R.inh * n * n), comb / Math.pow(n, R.roll), R.dec / (1 + R.decN * (n - 1) * (n - 1) * 0.5)]);
      }
    }
    parts = parts.filter(q => q[0] * freq < sr * 0.45 && q[0] * freq > 20);
    let maxDec = 0; for (const q of parts) maxDec = Math.max(maxDec, q[2] * keyF);
    const dur = Math.min(R.max || 5, maxDec * 1.6 + 0.05);
    const len = Math.ceil(dur * sr), out = new Float32Array(len);
    const att = R.att || 0.0015, attN = Math.max(1, Math.round(att * sr));
    parts.forEach((q, pi) => {
      const f = q[0] * freq, a = q[1], dc = Math.max(0.01, q[2] * keyF);
      const comps = R.beat && pi < 6 ? 2 : 1;                   // slow beating only where you can hear it
      const lenP = Math.min(len, Math.ceil(dc * (R.two ? 4 : 1) * Math.log(Math.max(1.01, a / 2e-4)) * sr));   // stop once inaudible
      for (let k = 0; k < comps; k++) {
        const det = comps === 2 ? (k ? 1 : -1) * R.beat * 0.5 : 0, fk = f * Math.pow(2, det / 1200);
        // recursive sine: y[n] = 2cos(w) y[n-1] - y[n-2]; decay folded in as a per-sample gain
        const w = TAU * fk / sr, g = Math.exp(-1 / (dc * sr)), c2 = 2 * Math.cos(w) * g, gg = g * g;
        const ph = r() * TAU, amp = a / comps;
        let y1 = Math.sin(ph) * amp, y2 = Math.sin(ph - w) * amp / g;
        const two = R.two || 0;
        if (two) {                                              // piano: fast first decay, then a long, quiet aftersound
          const g2 = Math.exp(-1 / (dc * 4 * sr)), c22 = 2 * Math.cos(w) * g2, gg2 = g2 * g2;
          let z1 = Math.sin(ph) * amp * two, z2 = Math.sin(ph - w) * amp * two / g2;
          y1 *= (1 - two); y2 *= (1 - two);
          for (let i = 0; i < lenP; i++) { const y = c2 * y1 - gg * y2; y2 = y1; y1 = y; const z = c22 * z1 - gg2 * z2; z2 = z1; z1 = z; out[i] += y + z; }
        } else for (let i = 0; i < lenP; i++) { const y = c2 * y1 - gg * y2; y2 = y1; y1 = y; out[i] += y; }
      }
    });
    for (let i = 0; i < attN; i++) out[i] *= i / attN;
    if (R.hammer) {
      const n = Math.ceil(0.02 * sr), nz = biquad(noise(n, r), 'bp', Math.min(sr * 0.4, freq * 4), 0.8, sr);
      for (let i = 0; i < n && i < len; i++) out[i] += nz[i] * R.hammer * Math.exp(-i / sr / 0.004);
    }
    fadeOut(out, Math.min(3000, len >> 3));
    return normalize(out, 0.9);
  };

  // ------------------------------------------------------------------------------------------ reverb impulse
  D.impulse = function (sr, decay, damp, pre) {
    decay = Math.max(0.2, Math.min(10, decay)); pre = Math.max(0, Math.min(0.25, pre || 0));
    const len = Math.ceil((decay * 1.1 + pre) * sr), off = Math.floor(pre * sr), chans = [];
    for (let c = 0; c < 2; c++) {
      const r = rng(77 + c * 911), x = new Float32Array(len);
      let lp = 0;
      for (let i = off; i < len; i++) {
        const t = (i - off) / sr, env = Math.exp(-6.9 * t / decay);
        const k = Math.min(0.98, (damp / sr) * TAU * Math.exp(-t * 1.5 * (8000 / Math.max(500, damp))) + 0.02);   // darker as it dies away
        lp += k * ((r() * 2 - 1) - lp);
        x[i] = lp * env;
      }
      // a few early reflections
      for (let e = 0; e < 6; e++) { const at = off + Math.floor((0.007 + r() * 0.03 * (1 + decay * 0.2)) * sr); if (at < len) x[at] += (r() - 0.5) * 0.9; }
      chans.push(x);
    }
    return chans;
  };
  // ------------------------------------------------------------------------------------------ wavetables from tables
  // harmonic amplitudes of a single-cycle table (for chip waves): plain DFT, n harmonics
  D.harmonics = function (table, n) {
    const N = table.length, re = new Float32Array(n + 1), im = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) { let a = 0, b = 0; for (let i = 0; i < N; i++) { const w = TAU * k * i / N; a += table[i] * Math.cos(w); b += table[i] * Math.sin(w); } re[k] = a * 2 / N; im[k] = b * 2 / N; }
    return [re, im];
  };
})(BeatLabEngine);

// Beat Lab engine, part 3: mixer effects. Each E.FX[type] has a name, a parameter list the editor builds its knobs from
// ([key, label, default, min, max, curve, unit] or [key, label, default, [choices]]) and make(ctx, engine) returning
// { input, output, set(params, engine), dispose() }. Effects with a dry/wet mix keep the dry path inside.
(function (E) {
  'use strict';
  const sp = (param, v, ctx) => E.sp(param, v, ctx);
  const SYNC_KEYS = ['1/32', '1/16T', '1/16', '1/8T', '1/8', '1/8.', '1/4T', '1/4', '1/4.', '1/2', '1/1'];
  function wetDry(ctx) {
    const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
    input.connect(dry); dry.connect(output); wet.connect(output);
    return { input, output, dry, wet, mix(v) { sp(dry.gain, Math.cos(v * Math.PI / 2), ctx); sp(wet.gain, Math.sin(v * Math.PI / 2), ctx); } };
  }
  const nodesOff = list => { for (const n of list) try { n.disconnect(); if (n.stop) n.stop(); } catch (e) {} };

  E.FX = {
    eq: {
      name: 'EQ (3-band)',
      params: [['lo', 'Low', 0, -18, 18, 'lin', 'dB'], ['mid', 'Mid', 0, -18, 18, 'lin', 'dB'], ['hi', 'High', 0, -18, 18, 'lin', 'dB'],
        ['lf', 'Low freq', 150, 40, 600, 'log', 'Hz'], ['mf', 'Mid freq', 1000, 200, 6000, 'log', 'Hz'], ['mq', 'Mid width', 0.9, 0.2, 4, 'log', ''], ['hf', 'High freq', 6000, 2000, 15000, 'log', 'Hz']],
      make(ctx) {
        const l = ctx.createBiquadFilter(), m = ctx.createBiquadFilter(), h = ctx.createBiquadFilter();
        l.type = 'lowshelf'; m.type = 'peaking'; h.type = 'highshelf'; l.connect(m); m.connect(h);
        return { input: l, output: h, set(p) { sp(l.gain, p.lo, ctx); sp(m.gain, p.mid, ctx); sp(h.gain, p.hi, ctx); sp(l.frequency, p.lf, ctx); sp(m.frequency, p.mf, ctx); sp(m.Q, p.mq, ctx); sp(h.frequency, p.hf, ctx); }, dispose() { nodesOff([l, m, h]); } };
      }
    },
    filter: {
      name: 'Filter',
      params: [['type', 'Type', 'lowpass', ['lowpass', 'highpass', 'bandpass', 'notch']], ['f', 'Cutoff', 2000, 30, 18000, 'log', 'Hz'], ['q', 'Resonance', 1, 0.3, 24, 'log', ''],
        ['lr', 'Wobble', 'off', ['off'].concat(SYNC_KEYS)], ['ld', 'Wobble depth', 0.5, 0, 1, 'lin', '']],
      make(ctx) {
        const f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.connect(lg); lg.connect(f.detune); lg.gain.value = 0; lfo.start();
        return { input: f, output: f, set(p, eng) {
          f.type = p.type; sp(f.frequency, p.f, ctx); sp(f.Q, p.q, ctx);
          const beats = E.SYNC[p.lr];
          if (beats) { sp(lfo.frequency, (eng.proj.bpm / 60) / beats, ctx); sp(lg.gain, p.ld * 3600, ctx); } else sp(lg.gain, 0, ctx);
        }, dispose() { nodesOff([f, lfo, lg]); } };
      }
    },
    comp: {
      name: 'Compressor',
      params: [['th', 'Threshold', -18, -60, 0, 'lin', 'dB'], ['ra', 'Ratio', 4, 1, 20, 'log', ':1'], ['at', 'Attack', 0.01, 0.001, 0.3, 'log', 's'], ['re', 'Release', 0.2, 0.02, 1, 'log', 's'],
        ['kn', 'Knee', 6, 0, 30, 'lin', 'dB'], ['mk', 'Makeup', 3, 0, 24, 'lin', 'dB']],
      make(ctx) {
        const c = ctx.createDynamicsCompressor(), g = ctx.createGain(); c.connect(g);
        return { input: c, output: g, set(p) { sp(c.threshold, p.th, ctx); sp(c.ratio, p.ra, ctx); sp(c.attack, p.at, ctx); sp(c.release, p.re, ctx); sp(c.knee, p.kn, ctx); sp(g.gain, Math.pow(10, p.mk / 20), ctx); }, dispose() { nodesOff([c, g]); } };
      }
    },
    dist: {
      name: 'Distortion',
      params: [['mode', 'Type', 'soft', ['soft', 'hard', 'tube', 'fold']], ['drive', 'Drive', 0.4, 0, 1, 'lin', ''], ['tone', 'Tone', 6000, 400, 16000, 'log', 'Hz'], ['mix', 'Mix', 1, 0, 1, 'lin', ''], ['out', 'Output', 0, -24, 12, 'lin', 'dB']],
      make(ctx) {
        const w = wetDry(ctx), ws = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), og = ctx.createGain();
        ws.oversample = '2x'; lp.type = 'lowpass';
        w.input.connect(ws); ws.connect(lp); lp.connect(w.wet); w.output.connect(og);
        let key = '';
        return { input: w.input, output: og, set(p) {
          const k = p.mode + p.drive;
          if (k !== key) {
            // every curve is scaled by 1/sqrt(its small-signal gain), so more drive means more grit, not just more level
            key = k; const n = 2048, cv = new Float32Array(n), d = 1 + p.drive * 40, fd = 1 + p.drive * 8;
            for (let i = 0; i < n; i++) {
              const x = i / (n - 1) * 2 - 1;
              cv[i] = p.mode === 'hard' ? Math.max(-1, Math.min(1, x * d * 0.5)) / Math.sqrt(d * 0.5 + 0.5) : p.mode === 'tube' ? (x >= 0 ? Math.tanh(x * d) : Math.tanh(x * d * 0.6) * 0.8) / Math.sqrt(d) : p.mode === 'fold' ? Math.sin(x * fd * Math.PI / 2) / Math.sqrt(fd) : Math.tanh(x * d) / Math.sqrt(d);
            }
            ws.curve = cv;
          }
          sp(lp.frequency, p.tone, ctx); w.mix(p.mix); sp(og.gain, Math.pow(10, p.out / 20), ctx);
        }, dispose() { nodesOff([w.input, w.output, w.dry, w.wet, ws, lp, og]); } };
      }
    },
    crush: {
      name: 'Bitcrusher',
      params: [['bits', 'Bits', 8, 1, 16, 'int', ''], ['down', 'Downsample', 4, 1, 40, 'int', 'x'], ['mix', 'Mix', 1, 0, 1, 'lin', '']],
      make(ctx) {
        const w = wetDry(ctx);
        let node = null, ws = null, lp = null;
        if (E.fx.workletOk(ctx)) { node = new AudioWorkletNode(ctx, 'bl-crush', { outputChannelCount: [2] }); w.input.connect(node); node.connect(w.wet); }
        else { ws = ctx.createWaveShaper(); lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; w.input.connect(ws); ws.connect(lp); lp.connect(w.wet); }
        let key = '';
        return { input: w.input, output: w.output, set(p) {
          if (node) { sp(node.parameters.get('bits'), p.bits, ctx); sp(node.parameters.get('down'), p.down, ctx); }
          else {
            if (key !== String(p.bits)) { key = String(p.bits); const n = 4096, cv = new Float32Array(n), st = Math.pow(0.5, p.bits - 1); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cv[i] = Math.round(x / st) * st; } ws.curve = cv; }
            sp(lp.frequency, Math.min(18000, ctx.sampleRate / 2 / p.down), ctx);
          }
          w.mix(p.mix);
        }, dispose() { nodesOff([w.input, w.output, w.dry, w.wet].concat(node ? [node] : [ws, lp])); } };
      }
    },
    delay: {
      name: 'Delay',
      params: [['time', 'Time', '1/8.', SYNC_KEYS.concat(['free'])], ['ms', 'Free time', 300, 10, 1500, 'log', 'ms'], ['fb', 'Feedback', 0.4, 0, 0.92, 'lin', ''],
        ['mix', 'Mix', 0.3, 0, 1, 'lin', ''], ['pp', 'Ping-pong', 'on', ['on', 'off']], ['damp', 'Tone', 5000, 500, 16000, 'log', 'Hz']],
      make(ctx) {
        const w = wetDry(ctx), dl = ctx.createDelay(4), dr = ctx.createDelay(4), fl = ctx.createGain(), fr = ctx.createGain(), lpL = ctx.createBiquadFilter(), lpR = ctx.createBiquadFilter();
        const mono = ctx.createGain(), merge = ctx.createChannelMerger(2), cross = ctx.createGain(), self = ctx.createGain();
        lpL.type = lpR.type = 'lowpass'; mono.channelCount = 1; mono.channelCountMode = 'explicit';
        w.input.connect(mono); mono.connect(dl);
        dl.connect(lpL); lpL.connect(fl); dr.connect(lpR); lpR.connect(fr);
        fl.connect(cross); cross.connect(dr);                     // ping-pong: left feeds right...
        fr.connect(dl);                                            // ...and right feeds left
        fl.connect(self); self.connect(dl);                        // plain: left feeds itself
        dl.connect(merge, 0, 0); dr.connect(merge, 0, 1); merge.connect(w.wet);
        return { input: w.input, output: w.output, set(p, eng) {
          const beats = E.SYNC[p.time], t = Math.min(3.9, beats ? beats * 60 / eng.proj.bpm : p.ms / 1000);
          sp(dl.delayTime, t, ctx); sp(dr.delayTime, t, ctx);
          const pp = p.pp !== 'off';
          sp(fl.gain, p.fb, ctx); sp(fr.gain, pp ? p.fb : 0, ctx);
          sp(cross.gain, pp ? 1 : 0, ctx); sp(self.gain, pp ? 0 : 1, ctx);
          sp(lpL.frequency, p.damp, ctx); sp(lpR.frequency, p.damp, ctx);
          // with ping-pong off the right side just copies the left
          if (pp !== this._pp) { try { dl.disconnect(merge); } catch (e) {} if (pp) dl.connect(merge, 0, 0); else { dl.connect(merge, 0, 0); dl.connect(merge, 0, 1); } this._pp = pp; }
          w.mix(p.mix);
        }, dispose() { nodesOff([w.input, w.output, w.dry, w.wet, dl, dr, fl, fr, lpL, lpR, mono, merge, cross, self]); } };
      }
    },
    reverb: {
      name: 'Reverb',
      params: [['size', 'Decay', 2.2, 0.3, 8, 'log', 's'], ['pre', 'Pre-delay', 0.02, 0, 0.2, 'lin', 's'], ['damp', 'Tone', 6000, 1000, 16000, 'log', 'Hz'], ['lc', 'Low cut', 150, 20, 1000, 'log', 'Hz'], ['mix', 'Mix', 0.25, 0, 1, 'lin', '']],
      make(ctx) {
        const w = wetDry(ctx), cv = ctx.createConvolver(), hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; w.input.connect(hp); hp.connect(cv); cv.connect(w.wet);
        let key = '', timer = 0;
        return { input: w.input, output: w.output, set(p) {
          const k = [p.size.toFixed(2), p.damp | 0, p.pre.toFixed(3)].join();
          if (k !== key) {
            key = k;
            const build = () => { const ir = E.fx.impulse(ctx, p.size, p.damp, p.pre); cv.buffer = ir; };
            if (!cv.buffer || ctx instanceof OfflineAudioContext) build();
            else { clearTimeout(timer); timer = setTimeout(build, 120); }   // knob drags: build once it settles
          }
          sp(hp.frequency, p.lc, ctx); w.mix(p.mix);
        }, dispose() { clearTimeout(timer); nodesOff([w.input, w.output, w.dry, w.wet, cv, hp]); } };
      }
    },
    chorus: {
      name: 'Chorus / Flanger',
      params: [['mode', 'Type', 'chorus', ['chorus', 'flanger']], ['rate', 'Rate', 0.8, 0.05, 8, 'log', 'Hz'], ['depth', 'Depth', 0.5, 0, 1, 'lin', ''], ['fb', 'Feedback', 0, -0.9, 0.9, 'lin', ''], ['mix', 'Mix', 0.5, 0, 1, 'lin', '']],
      make(ctx) {
        const w = wetDry(ctx), dl = ctx.createDelay(0.1), dr = ctx.createDelay(0.1), lfo = ctx.createOscillator(), gl = ctx.createGain(), gr = ctx.createGain();
        const fbl = ctx.createGain(), fbr = ctx.createGain(), merge = ctx.createChannelMerger(2);
        lfo.connect(gl); lfo.connect(gr); gl.connect(dl.delayTime); gr.connect(dr.delayTime); lfo.start();
        w.input.connect(dl); w.input.connect(dr); dl.connect(fbl); fbl.connect(dl); dr.connect(fbr); fbr.connect(dr);
        dl.connect(merge, 0, 0); dr.connect(merge, 0, 1); merge.connect(w.wet);
        return { input: w.input, output: w.output, set(p) {
          const fl = p.mode === 'flanger', base = fl ? 0.003 : 0.016, dep = (fl ? 0.0025 : 0.007) * p.depth;
          sp(dl.delayTime, base, ctx); sp(dr.delayTime, base, ctx);
          sp(gl.gain, dep, ctx); sp(gr.gain, -dep, ctx); sp(lfo.frequency, p.rate, ctx);
          const fb = fl ? p.fb : p.fb * 0.5; sp(fbl.gain, fb, ctx); sp(fbr.gain, fb, ctx);
          w.mix(p.mix);
        }, dispose() { nodesOff([w.input, w.output, w.dry, w.wet, dl, dr, lfo, gl, gr, fbl, fbr, merge]); } };
      }
    },
    phaser: {
      name: 'Phaser',
      params: [['rate', 'Rate', 0.4, 0.03, 8, 'log', 'Hz'], ['depth', 'Depth', 0.7, 0, 1, 'lin', ''], ['freq', 'Centre', 900, 200, 4000, 'log', 'Hz'], ['fb', 'Feedback', 0.4, 0, 0.9, 'lin', ''], ['mix', 'Mix', 0.5, 0, 1, 'lin', '']],
      make(ctx) {
        const w = wetDry(ctx), aps = [], lfo = ctx.createOscillator(), lg = ctx.createGain(), fb = ctx.createGain(), sum = ctx.createGain();
        lfo.connect(lg); lfo.start();
        w.input.connect(sum);
        let prev = sum;
        for (let i = 0; i < 4; i++) { const a = ctx.createBiquadFilter(); a.type = 'allpass'; a.Q.value = 0.6; lg.connect(a.detune); prev.connect(a); prev = a; aps.push(a); }
        prev.connect(fb); fb.connect(sum); prev.connect(w.wet);
        return { input: w.input, output: w.output, set(p) {
          aps.forEach((a, i) => sp(a.frequency, p.freq * (1 + i * 0.4), ctx));
          sp(lg.gain, p.depth * 2400, ctx); sp(lfo.frequency, p.rate, ctx); sp(fb.gain, p.fb, ctx); w.mix(p.mix);
        }, dispose() { nodesOff([w.input, w.output, w.dry, w.wet, lfo, lg, fb, sum].concat(aps)); } };
      }
    },
    limit: {
      name: 'Limiter',
      params: [['th', 'Ceiling', -1, -24, 0, 'lin', 'dB'], ['gain', 'Gain', 0, 0, 18, 'lin', 'dB'], ['re', 'Release', 0.1, 0.01, 1, 'log', 's']],
      make(ctx) {
        const g = ctx.createGain(), c = ctx.createDynamicsCompressor(); g.connect(c);
        c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.002;
        return { input: g, output: c, set(p) { sp(g.gain, Math.pow(10, p.gain / 20), ctx); sp(c.threshold, p.th, ctx); sp(c.release, p.re, ctx); }, dispose() { nodesOff([g, c]); } };
      }
    }
  };
  E.FX_ORDER = ['eq', 'filter', 'comp', 'dist', 'crush', 'delay', 'reverb', 'chorus', 'phaser', 'limit'];
  E.fxDefaults = function (t) { const d = {}; for (const q of (E.FX[t] || { params: [] }).params) d[q[0]] = q[2]; return d; };

  // shared helpers: impulse responses (cached per context) and the bitcrusher worklet
  const F = E.fx = {};
  F.impulse = function (ctx, size, damp, pre) {
    ctx.__irs = ctx.__irs || new Map();
    const key = [size.toFixed(2), damp | 0, pre.toFixed(3)].join();
    let b = ctx.__irs.get(key);
    if (!b) {
      const ch = E.dsp.impulse(ctx.sampleRate, size, damp, pre);
      b = ctx.createBuffer(2, ch[0].length, ctx.sampleRate); b.copyToChannel(ch[0], 0); b.copyToChannel(ch[1], 1);
      if (ctx.__irs.size > 12) ctx.__irs.clear();
      ctx.__irs.set(key, b);
    }
    return b;
  };
  const CRUSH = `class C extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:'bits',defaultValue:8,minValue:1,maxValue:16},{name:'down',defaultValue:4,minValue:1,maxValue:64}]}
constructor(){super();this.h=[0,0];this.c=0}process(i,o,p){const a=i[0],b=o[0];if(!a||!a.length){return true}const st=Math.pow(.5,p.bits[0]-1),dn=Math.max(1,p.down[0]);let c0=this.c;
for(let ch=0;ch<b.length;ch++){const x=a[ch]||a[0],y=b[ch];let c=c0,h=this.h[ch]||0;for(let n=0;n<y.length;n++){if(c<=0){h=Math.round(x[n]/st)*st;c+=dn}c--;y[n]=h}this.h[ch]=h;if(ch===b.length-1)this.c=c}return true}}
registerProcessor('bl-crush',C);`;
  F.workletOk = ctx => !!(ctx && ctx.__blWorklet === true);
  F.prepare = function (ctx) {
    if (ctx.__blWorkletP) return ctx.__blWorkletP;
    if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined' || typeof Blob === 'undefined') return (ctx.__blWorkletP = Promise.resolve(false));
    let url;
    try { url = URL.createObjectURL(new Blob([CRUSH], { type: 'application/javascript' })); } catch (e) { return (ctx.__blWorkletP = Promise.resolve(false)); }
    ctx.__blWorkletP = ctx.audioWorklet.addModule(url).then(() => { ctx.__blWorklet = true; return true; }, () => false)
      .then(ok => { try { URL.revokeObjectURL(url); } catch (e) {} return ok; });
    return ctx.__blWorkletP;
  };
})(BeatLabEngine);

// Beat Lab engine, part 4: instrument voices.
// Synth params (k: 'syn'):
//   o1, o2: { w: wave, oct, semi, fine (cents), lvl 0..1, uni: unison voices 1..7, det: unison spread (cents) }
//      wave: sine square sawtooth triangle | a wavetable (E.WAVES) | 'noise' | 'pluck' (Karplus-Strong string, ks: {})
//            | 'm:<name>' a modal tone (piano, marimba, bell... see E.dsp.MODAL) | 'off'
//   sub (sine an octave down, level), nz (noise level), fm (FM index on the oscillators), fmr (modulator ratio),
//   fmd (FM decay seconds, 0 = steady), f: filter { t: lp|hp|bp|notch, fc Hz, q, env (octaves), kt (key tracking 0..1),
//   vel (octaves darker at low velocity), a d s r }, amp: { a d s r }, pe/pt (pitch envelope: semitones, seconds),
//   glide (seconds, mono legato), mono, lfo { w, r Hz, sync ('1/8'...), tgt: off|pitch|filter|amp, amt },
//   vel (velocity sensitivity 0..1), drive 0..1, vowel ('a','e','i','o','u' formant filter), gain, poly
// Drum params (k: 'drm'): { d: { type, tune, dec, tone, snap, drive, crush }, gain, cg (choke group: one voice per group) }
(function (E) {
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  E.SYNTH_DEFAULT = {
    k: 'syn',
    o1: { w: 'sawtooth', oct: 0, semi: 0, fine: 0, lvl: 1, uni: 1, det: 14 },
    o2: { w: 'off', oct: 0, semi: 0, fine: 0, lvl: 0.6, uni: 1, det: 14 },
    sub: 0, nz: 0, fm: 0, fmr: 2, fmd: 0,
    f: { t: 'lp', fc: 18000, q: 0.7, env: 0, kt: 0, vel: 0, a: 0.005, d: 0.4, s: 0.6, r: 0.4 },
    amp: { a: 0.004, d: 0.4, s: 0.8, r: 0.25 },
    pe: 0, pt: 0.08, glide: 0, mono: 0,
    lfo: { w: 'sine', r: 5, sync: '', tgt: 'off', amt: 0 },
    vel: 0.6, drive: 0, vowel: '', gain: 0.8, poly: 12,
    ks: { damp: 0.4, bright: 0.6, dur: 3, pos: 0.13 }
  };
  E.DRUM_DEFAULT = { k: 'drm', d: { type: 'kick', tune: 0, dec: 1, tone: 0.5, snap: 0.5, drive: 0, crush: 0 }, gain: 0.8, cg: 0 };
  E.normParams = function (s) {
    if (!s || typeof s !== 'object') return clone(E.SYNTH_DEFAULT);
    s = clone(s);
    return E.fill(s, s.k === 'drm' ? E.DRUM_DEFAULT : E.SYNTH_DEFAULT);
  };
  // formants (Hz, level, bandwidth) for the vowel filter
  E.VOWELS = {
    a: [[800, 1, 80], [1150, 0.5, 90], [2900, 0.25, 120]], e: [[400, 1, 60], [1700, 0.4, 80], [2600, 0.25, 120]],
    i: [[300, 1, 60], [2200, 0.3, 90], [3000, 0.2, 100]], o: [[450, 1, 70], [800, 0.5, 80], [2830, 0.15, 100]],
    u: [[325, 1, 50], [700, 0.3, 60], [2530, 0.1, 170]]
  };

  // ---------------------------------------------------------------- wavetables (PeriodicWave, built per context)
  const H = {};                                     // name -> [real, imag] harmonic arrays, or {div, h}
  function harm(fn, n) { const im = new Float32Array(n + 1); for (let k = 1; k <= n; k++) im[k] = fn(k); return { im }; }
  function drawbar(s) {                             // Hammond footages 16' 5 1/3' 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1', as harmonics of the 16' (divide by 2)
    const hs = [1, 3, 2, 4, 6, 8, 10, 12, 16], im = new Float32Array(17);
    for (let i = 0; i < 9; i++) im[hs[i]] += (+s[i] || 0) / 8;
    return { im, div: 2 };
  }
  H.pulse25 = harm(k => 2 / (k * Math.PI) * Math.sin(k * Math.PI * 0.25), 48);
  H.pulse12 = harm(k => 2 / (k * Math.PI) * Math.sin(k * Math.PI * 0.125), 48);
  H.softsaw = harm(k => 1 / Math.pow(k, 1.5), 40);
  H.warm = harm(k => 1 / k * Math.exp(-k / 9), 40);
  H.bright = harm(k => 1 / Math.pow(k, 0.75), 48);
  H.hollow = harm(k => k % 2 ? 1 / (k * k) : 0, 31);
  H.reed = harm(k => k % 2 ? 1 / k : 0.08 / k, 30);
  H.oboe = harm(k => [0, 0.5, 1, 0.8, 0.65, 0.35, 0.3, 0.15, 0.12, 0.08, 0.05][k] || 0.03 / k, 24);
  H.brass = harm(k => (1 / k) * (1 + 1.5 * Math.exp(-Math.pow((k - 5) / 3, 2))), 40);
  H.flute = harm(k => [0, 1, 0.35, 0.12, 0.05, 0.02][k] || 0, 5);
  H.string = harm(k => (1 / k) * (1 + 0.6 * Math.exp(-Math.pow((k - 4) / 2.5, 2))) * (k > 20 ? 0.5 : 1), 40);
  H.vox = harm(k => { const f = k * 220; return 0.2 / k + Math.exp(-Math.pow((f - 700) / 150, 2)) + 0.5 * Math.exp(-Math.pow((f - 1150) / 160, 2)) + 0.25 * Math.exp(-Math.pow((f - 2800) / 300, 2)); }, 30);
  H.glass = harm(k => ({ 1: 1, 4: 0.5, 8: 0.3, 12: 0.15, 16: 0.08 })[k] || 0, 16);
  H.buzz = harm(k => 1 / Math.pow(k, 0.3), 40);
  H.clav = harm(k => Math.abs(Math.sin(Math.PI * k * 0.2)) / Math.pow(k, 0.7), 40);
  H.organ1 = drawbar('888000000');                  // jazz
  H.organ2 = drawbar('888888888');                  // full gospel
  H.organ3 = drawbar('008800000');                  // soft flutes
  H.organ4 = drawbar('868000004');                  // rock with a click of 1'
  H.pipe = drawbar('048636404');                    // church principal + mixture
  H.reedorgan = harm(k => (k % 2 ? 1 : 0.6) / Math.pow(k, 0.9), 30);
  H.farfisa = harm(k => (k % 2 ? 1 / k : 0.3 / k), 30);
  (function chip() {
    const tri = []; for (let i = 0; i < 32; i++) tri.push((i < 16 ? i : 31 - i) / 7.5 - 1);       // NES triangle, 4-bit steps
    const gb = []; for (let i = 0; i < 32; i++) gb.push(Math.round((Math.sin(i / 32 * Math.PI * 2) + 0.6 * Math.sin(i / 32 * Math.PI * 4)) * 4) / 6);
    H.nestri = { tbl: tri }; H.gbwave = { tbl: gb };
  })();
  E.WAVES = ['sine', 'triangle', 'square', 'sawtooth'].concat(Object.keys(H));
  E.WAVE_SOURCES = ['noise', 'pluck'].concat(Object.keys(E.dsp.MODAL).map(k => 'm:' + k));
  function wave(ctx, name) {
    ctx.__waves = ctx.__waves || {};
    let w = ctx.__waves[name];
    if (!w) {
      const d = H[name];
      let re, im;
      if (d.tbl) { [re, im] = E.dsp.harmonics(d.tbl, 32); }
      else { im = d.im; re = new Float32Array(im.length); }
      w = ctx.__waves[name] = { pw: ctx.createPeriodicWave(re, im), div: d.div || 1 };
    }
    return w;
  }
  E.wave = wave;
  function noiseBuf(ctx) {
    if (!ctx.__noise) {
      const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = E.dsp.rng(99);
      for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
      ctx.__noise = b;
    }
    return ctx.__noise;
  }
  // cached rendered buffers (plucks, modal tones), least recently used dropped past ~48 MB
  const CACHE = new Map(); let cacheBytes = 0;
  function cached(ctx, key, make) {
    const k = ctx.sampleRate + '|' + key;
    let b = CACHE.get(k);
    if (b) { CACHE.delete(k); CACHE.set(k, b); return b; }
    const data = make(ctx.sampleRate);
    b = ctx.createBuffer(1, data.length, ctx.sampleRate); b.copyToChannel(data, 0);
    CACHE.set(k, b); cacheBytes += data.length * 4;
    while (cacheBytes > 48e6 && CACHE.size > 1) { const [k0, b0] = CACHE.entries().next().value; CACHE.delete(k0); cacheBytes -= b0.length * 4; }
    return b;
  }
  function srcBuffer(ctx, s, w, midi) {
    if (w === 'pluck') { const ks = s.ks, f = E.mtof(midi); return cached(ctx, 'ks' + midi + '|' + ks.damp + '|' + ks.bright + '|' + ks.dur + '|' + ks.pos, sr => E.dsp.pluck(f, sr, ks)); }
    const name = w.slice(2); return cached(ctx, 'm' + name + midi, sr => E.dsp.modal(E.mtof(midi), sr, name));
  }
  E.srcBuffer = srcBuffer;
  // render ahead what a channel will need, so the first play has no hiccup (called by the UI when idle)
  E.warm = function (ctx, s, notes) {
    if (!ctx || !s) return;
    if (s.k === 'drm') return;
    for (const o of [s.o1, s.o2]) if (o && (o.w === 'pluck' || /^m:/.test(o.w))) for (const n of notes) srcBuffer(ctx, s, o.w, Math.round(n + o.oct * 12 + o.semi));
  };
  E.drumBuffer = function (ctx, d) { return cached(ctx, 'd' + JSON.stringify(d), sr => E.dsp.drum(d, sr)); };

  const hold = (param, t) => { if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t); else param.cancelScheduledValues(t); };
  const clampF = (f, ctx) => Math.max(20, Math.min(ctx.sampleRate * 0.45, f));
  const FT = { lp: 'lowpass', hp: 'highpass', bp: 'bandpass', notch: 'notch' };

  // ---------------------------------------------------------------- start a voice (dur: seconds, or null = held)
  // x: articulation (from eng._fire), all optional: { amp: gain x, bright: open the filter, rel: release seconds,
  //    from: midi to glide from over gt seconds (bend: keep the last note sounding), vib: vibrato, fall: seconds }
  E.voiceStart = function (eng, c, midi, vel, t, dur, x) {
    const ctx = eng.ctx, s = c.s;
    if (t < ctx.currentTime) t = ctx.currentTime;
    vel = Math.max(0.01, Math.min(1, vel));
    x = x || {};
    if (s.k === 'drm') return drumVoice(eng, c, s, midi, vel, t, dur, x);
    // polyphony per channel / mono legato
    let glideFrom = null, glideT = s.glide;
    const live = c.voices.filter(v => !v.dead && v.end > t);
    if (x.from != null) {                        // slide / bend: start at another pitch and glide to this one
      glideFrom = x.from; glideT = x.gt;
      if (!x.bend) for (const v of live) if (v.t0 < t) E.voiceRelease(eng, v, t, 0.03);     // legato: the last note hands over
    } else if (s.mono) {
      const prev = live[live.length - 1];
      if (prev && (prev.rel == null || prev.rel > t + 0.002)) glideFrom = prev.midi;
      for (const v of live) E.voiceKill(eng, v, t);
    } else if (live.length >= (s.poly || 12)) E.voiceKill(eng, live[0], t);

    const v = { c, midi, t0: t, srcs: [], lfoT: [], end: Infinity, rel: null, s };
    const dets = [];                           // detune params the vibrato and fall act on
    const out = ctx.createGain(); out.gain.value = 0; v.out = out;
    let dest = out;
    const useF = s.f.fc < 17500 || s.f.env !== 0 || s.f.t !== 'lp' || (c.lfoTgt === 'filter');
    if (useF) {
      const f = ctx.createBiquadFilter(); f.type = FT[s.f.t] || 'lowpass'; f.Q.value = s.f.q; f.connect(out); v.filt = f; dest = f;
      if (c.lfoTgt === 'filter' && c.lfoG) { c.lfoG.connect(f.detune); v.lfoT.push(f.detune); }
    }
    const anyUni = (s.o1.w !== 'off' && s.o1.uni > 1) || (s.o2.w !== 'off' && s.o2.uni > 1);
    let pl = null, pr = null;
    if (anyUni) { pl = ctx.createStereoPanner(); pr = ctx.createStereoPanner(); pl.pan.value = -0.7; pr.pan.value = 0.7; pl.connect(dest); pr.connect(dest); }
    const carriers = [];                       // oscillators FM and glide act on
    let fmG = null;
    if (s.fm > 0) {
      const mod = ctx.createOscillator(), f0 = E.mtof(midi + s.o1.oct * 12 + s.o1.semi);
      mod.frequency.value = f0 * s.fmr; fmG = ctx.createGain();
      const peak = s.fm * f0 * s.fmr * (0.4 + 0.6 * vel);
      fmG.gain.setValueAtTime(peak, t);
      if (s.fmd > 0) fmG.gain.setTargetAtTime(peak * 0.04, t, s.fmd / 3);
      mod.connect(fmG); v.srcs.push(mod);
    }
    const addOsc = (o, isSub) => {
      if (!o || o.w === 'off' || !(o.lvl > 0)) return;
      const n = midi + o.oct * 12 + o.semi;
      if (o.w === 'pluck' || o.w.startsWith('m:')) {
        const b = ctx.createBufferSource(); b.buffer = srcBuffer(ctx, s, o.w, Math.round(n));
        b.detune.value = o.fine + (n - Math.round(n)) * 100; dets.push([b.detune, b.detune.value]);
        if (glideFrom != null && x.from != null && glideFrom !== midi) { b.detune.setValueAtTime(b.detune.value + (glideFrom - midi) * 100, t); b.detune.linearRampToValueAtTime(b.detune.value, t + Math.max(0.01, glideT)); }
        const g = ctx.createGain(); g.gain.value = o.lvl; b.connect(g); g.connect(dest);
        v.srcs.push(b); v.bufEnd = Math.max(v.bufEnd || 0, t + b.buffer.duration);
        if (s.pe) { b.detune.setValueAtTime(o.fine + s.pe * 100, t); b.detune.setTargetAtTime(o.fine, t, s.pt / 3); }
        return;
      }
      if (o.w === 'noise') {
        const b = ctx.createBufferSource(); b.buffer = noiseBuf(ctx); b.loop = true;
        const g = ctx.createGain(); g.gain.value = o.lvl * 0.7; b.connect(g); g.connect(dest); b.__off = Math.random() * 1.5; v.srcs.push(b);
        return;
      }
      const uni = Math.max(1, Math.min(7, o.uni | 0)), wv = E.WAVES.indexOf(o.w) > 3 ? wave(ctx, o.w) : null;
      const f = E.mtof(n) / (wv ? wv.div : 1);
      const gs = uni > 1 ? [ctx.createGain(), ctx.createGain()] : [ctx.createGain()];
      gs.forEach((g, i) => { g.gain.value = o.lvl / Math.sqrt(uni) * (uni > 1 ? 1.2 : 1); g.connect(uni > 1 ? (i ? pr : pl) : dest); });
      for (let u = 0; u < uni; u++) {
        const osc = ctx.createOscillator();
        if (wv) osc.setPeriodicWave(wv.pw); else osc.type = o.w;
        const spread = uni > 1 ? o.det * (u / (uni - 1) - 0.5) * 2 : 0, base = o.fine + spread;
        osc.frequency.value = f; osc.detune.value = base;
        if (s.pe) { osc.detune.setValueAtTime(base + s.pe * 100, t); osc.detune.setTargetAtTime(base, t, s.pt / 3); }
        osc.connect(gs[uni > 1 ? u % 2 : 0]);
        v.srcs.push(osc); carriers.push({ osc, f }); dets.push([osc.detune, base]);
        if (c.lfoTgt === 'pitch' && c.lfoG) { c.lfoG.connect(osc.detune); v.lfoT.push(osc.detune); }
      }
    };
    addOsc(s.o1); addOsc(s.o2);
    if (s.sub > 0) addOsc({ w: 'sine', oct: -1, semi: s.o1.semi, fine: 0, lvl: s.sub, uni: 1, det: 0 });
    if (s.nz > 0) addOsc({ w: 'noise', lvl: s.nz });
    if (fmG) for (const cr of carriers) fmG.connect(cr.osc.frequency);
    if (glideFrom != null && glideT > 0 && glideFrom !== midi) {
      const ratio = Math.pow(2, (glideFrom - midi) / 12);
      for (const cr of carriers) { cr.osc.frequency.setValueAtTime(cr.f * ratio, t); cr.osc.frequency.exponentialRampToValueAtTime(cr.f, t + glideT); }
    }
    if (x.vib && dets.length) {                  // vibrato: a sine wobble of the pitch that fades in
      const lo = ctx.createOscillator(), lg = ctx.createGain();
      lo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(38, t + 0.22);
      lo.connect(lg); for (const [d] of dets) lg.connect(d);
      v.srcs.push(lo);
    }
    if (x.fall && dur != null) {                 // fall: the pitch drops away at the end of the note
      const ts = t + Math.max(0.01, dur - x.fall);
      for (const [d, base] of dets) { d.setValueAtTime(base, ts); d.linearRampToValueAtTime(base - 900, ts + x.fall + 0.12); }
    }
    // filter envelope
    if (v.filt) {
      const F = s.f, fc0 = clampF(F.fc * Math.pow(2, F.kt * (midi - 60) / 12) * Math.pow(2, F.vel * (vel - 1)) * (x.bright ? 2.2 : 1), ctx);
      v.fc0 = fc0;
      const fp = v.filt.frequency;
      if (F.env) {
        const peak = clampF(fc0 * Math.pow(2, F.env), ctx), sus = clampF(fc0 * Math.pow(2, F.env * F.s), ctx);
        fp.setValueAtTime(fc0, t); fp.exponentialRampToValueAtTime(peak, t + Math.max(0.002, F.a)); fp.setTargetAtTime(sus, t + Math.max(0.002, F.a), Math.max(0.005, F.d) / 4);
      } else fp.setValueAtTime(fc0, t);
    }
    // amp envelope
    const A = s.amp, peak = s.gain * 0.24 * (1 - s.vel + s.vel * Math.pow(vel, 1.3)) * (x.amp || 1);
    const g = out.gain;
    g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + Math.max(0.0015, A.a));
    g.setTargetAtTime(peak * A.s, t + Math.max(0.0015, A.a), Math.max(0.005, A.d) / 4);
    v.peak = peak;
    out.connect(c.input);
    let natural = Infinity;                      // decays to nothing by itself
    if (A.s <= 0.001) natural = t + A.a + A.d * 1.3 + 0.02;
    if (v.bufEnd && !carriers.length && !(s.nz > 0)) natural = Math.min(natural, v.bufEnd);
    v.natural = natural;
    for (const src of v.srcs) src.start(t, src.__off || 0);
    if (natural < Infinity) { v.end = natural; for (const src of v.srcs) src.stop(natural); }
    if (dur != null) E.voiceRelease(eng, v, t + Math.max(0.01, dur), x.rel);
    else v.live = true;
    return v;
  };
  E.voiceRelease = function (eng, v, tr, fast) {
    if (v.dead || v.rel != null && v.rel <= tr) return;
    if (tr >= v.natural) return;
    const s = v.s;
    v.rel = tr;
    if (!v.out) return;
    const r = fast || (s.k === 'drm' ? 0.05 : Math.max(0.005, s.amp.r));
    hold(v.out.gain, tr); v.out.gain.setTargetAtTime(0, tr, r / 5);
    if (v.filt && s.f && s.f.env) { hold(v.filt.frequency, tr); v.filt.frequency.setTargetAtTime(v.fc0, tr, Math.max(0.005, s.f.r) / 5); }
    const end = Math.min(v.natural, tr + r + 0.03);
    v.end = end;
    for (const src of v.srcs) try { src.stop(end); } catch (e) {}
  };
  E.voiceKill = function (eng, v, t) {
    if (v.dead) return;
    t = Math.max(t, eng.ctx.currentTime);
    if (t >= v.end) return;
    v.dead = true;
    if (v.out) { hold(v.out.gain, t); v.out.gain.linearRampToValueAtTime(0, t + 0.008); }
    v.end = t + 0.012;
    for (const src of v.srcs) try { src.stop(v.end); } catch (e) {}
  };
  E.voiceFree = function (eng, v) {
    if (v.freed) return;
    v.freed = true; v.dead = true;
    if (v.lfoT.length && v.c.lfoG) for (const prm of v.lfoT) try { v.c.lfoG.disconnect(prm); } catch (e) {}
    try { v.out.disconnect(); } catch (e) {}
  };

  function drumVoice(eng, c, s, midi, vel, t, dur, x) {
    const ctx = eng.ctx;
    if (!c.buf || c.bufCtx !== ctx) { c.buf = E.drumBuffer(ctx, s.d); c.bufCtx = ctx; }
    const v = { c, midi, t0: t, srcs: [], lfoT: [], end: Infinity, rel: null, s };
    if (s.cg) {                                  // choke group: a new hit cuts the last one in its group (open hat by closed hat)
      const last = eng.chokes.get(s.cg);
      if (last && !last.dead && last.end > t) E.voiceKill(eng, last, t);
      eng.chokes.set(s.cg, v);
    }
    const b = ctx.createBufferSource(); b.buffer = c.buf;
    const rate = Math.pow(2, (midi - 60) / 12); b.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = s.gain * 0.38 * (0.25 + 0.75 * Math.pow(vel, 1.2)) * (x.amp || 1);
    b.connect(g); g.connect(c.input);
    v.out = g; v.srcs.push(b); v.natural = t + c.buf.duration / rate; v.end = v.natural;
    b.start(t); b.stop(v.end);
    return v;
  }

  // metronome click (straight to the master, before its effects)
  E.click = function (eng, t, accent) {
    const ctx = eng.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175; o.type = 'square';
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(accent ? 0.22 : 0.13, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045);
    o.connect(g); g.connect(eng.mix[0] ? eng.mix[0].post : ctx.destination); o.start(t); o.stop(t + 0.05);
  };
})(BeatLabEngine);

// Beat Lab engine, part 5: the preset library (E.PRESETS). Every sound is a short list of changes to the synth or drum
// defaults in 13-engine-voice.js; E.preset(id) returns the full, editable params.
(function (E) {
  'use strict';
  const L = [];
  const o = (w, x) => Object.assign({ w }, x || {});
  const A = (a, d, s, r) => ({ a, d, s, r });
  const F = (fc, q, env, a, d, s, r, x) => Object.assign({ t: 'lp', fc, q: q == null ? 0.7 : q, env: env || 0, a: a == null ? 0.005 : a, d: d == null ? 0.4 : d, s: s == null ? 0.6 : s, r: r == null ? 0.4 : r }, x || {});
  const LFO = (tgt, amt, r, x) => Object.assign({ w: 'sine', r: r || 5, tgt, amt, sync: '' }, x || {});
  const syn = (c, n, p) => L.push({ c, n, p: Object.assign({ k: 'syn' }, p) });
  const kit = (c, prefix, list) => list.forEach(([n, d, gain, cg]) => L.push({ c, n: prefix + ' ' + n, p: { k: 'drm', d, gain: gain == null ? 0.8 : gain, cg: cg || 0 } }));
  const ks = (damp, bright, dur, pos) => ({ damp, bright, dur, pos: pos == null ? 0.13 : pos });

  // ------------------------------------------------------------------ Keys
  let C = 'Keys';
  syn(C, 'Grand Piano', { o1: o('m:piano'), amp: A(0.001, 1, 1, 0.35), f: F(9000, 0.5, 0, 0, 0, 0, 0, { kt: 0.4, vel: 1.6 }), vel: 0.8, gain: 0.95, poly: 16 });
  syn(C, 'Bright Piano', { o1: o('m:brightpiano'), amp: A(0.001, 1, 1, 0.3), f: F(14000, 0.5, 0, 0, 0, 0, 0, { kt: 0.3, vel: 1.2 }), vel: 0.75, gain: 0.9, poly: 16 });
  syn(C, 'Felt Piano', { o1: o('m:felt'), amp: A(0.002, 1, 1, 0.5), f: F(2600, 0.5, 0, 0, 0, 0, 0, { kt: 0.5, vel: 1 }), vel: 0.7, gain: 1, poly: 16 });
  syn(C, 'Upright Piano', { o1: o('m:upright'), amp: A(0.001, 1, 1, 0.3), f: F(7000, 0.5, 0, 0, 0, 0, 0, { kt: 0.4, vel: 1.4 }), vel: 0.8, gain: 0.95, poly: 16 });
  syn(C, 'Lo-fi Piano', { o1: o('m:felt'), amp: A(0.002, 1, 1, 0.4), f: F(2000, 0.6, 0, 0, 0, 0, 0, { kt: 0.3, vel: 0.8 }), lfo: LFO('pitch', 0.12, 0.6), drive: 0.15, vel: 0.6, gain: 1, poly: 16 });
  syn(C, 'Honky-tonk Piano', { o1: o('m:upright', { fine: -9 }), o2: o('m:upright', { fine: 9, lvl: 0.85 }), amp: A(0.001, 1, 1, 0.3), f: F(6500, 0.5, 0, 0, 0, 0, 0, { kt: 0.3, vel: 1 }), gain: 0.75, poly: 16 });
  syn(C, 'Toy Piano', { o1: o('m:toypiano', { oct: 1 }), amp: A(0.001, 1, 1, 0.3), gain: 0.85 });
  syn(C, 'Tine Electric Piano', { o1: o('m:epiano'), amp: A(0.002, 1, 1, 0.4), f: F(5000, 0.6, 0, 0, 0, 0, 0, { vel: 1.5 }), lfo: LFO('amp', 0.25, 4.5), vel: 0.8, gain: 0.9, poly: 16 });
  syn(C, 'FM Electric Piano', { o1: o('sine'), o2: o('sine', { fine: 6, lvl: 0.4 }), fm: 1.8, fmr: 1, fmd: 0.7, amp: A(0.002, 3, 0, 0.45), vel: 0.8, gain: 0.8, poly: 16 });
  syn(C, '80s DX Piano', { o1: o('sine'), o2: o('sine', { fine: 7, lvl: 0.5 }), fm: 0.9, fmr: 14, fmd: 0.25, amp: A(0.001, 2.4, 0, 0.5), vel: 0.8, gain: 0.8, poly: 16 });
  syn(C, 'Wurli', { o1: o('hollow'), o2: o('pulse25', { lvl: 0.3 }), f: F(2800, 0.8, 1.2, 0.002, 0.5, 0.3, 0.3, { vel: 1 }), amp: A(0.002, 1.8, 0, 0.3), lfo: LFO('amp', 0.2, 5.5), drive: 0.2, gain: 0.75 });
  syn(C, 'Clavinet', { o1: o('m:clav'), f: F(4500, 3, 1, 0.001, 0.2, 0.2, 0.1, { vel: 1.5 }), amp: A(0.001, 1, 1, 0.07), gain: 0.85 });
  syn(C, 'Harpsichord', { o1: o('pluck'), o2: o('pluck', { oct: 1, lvl: 0.35 }), ks: ks(0.12, 1, 2.5, 0.07), amp: A(0.001, 1, 1, 0.25), f: F(9000), gain: 0.75 });
  syn(C, 'Music Box', { o1: o('m:musicbox', { oct: 1 }), amp: A(0.001, 1, 1, 1.2), gain: 0.8 });
  syn(C, 'Celesta', { o1: o('m:celesta', { oct: 1 }), amp: A(0.001, 1, 1, 0.6), gain: 0.85 });
  syn(C, 'Juno Keys', { o1: o('sawtooth'), o2: o('pulse25', { lvl: 0.5 }), f: F(1800, 1.5, 2, 0.003, 0.5, 0.3, 0.3), amp: A(0.003, 1, 0.5, 0.3), gain: 0.6 });

  // ------------------------------------------------------------------ Organs
  C = 'Organs';
  syn(C, 'Jazz Organ', { o1: o('organ1'), amp: A(0.003, 0.1, 1, 0.06), f: F(9000), lfo: LFO('pitch', 0.15, 6.5), drive: 0.15, gain: 0.55 });
  syn(C, 'Gospel Organ', { o1: o('organ2'), amp: A(0.003, 0.1, 1, 0.08), lfo: LFO('pitch', 0.12, 6), drive: 0.12, gain: 0.45 });
  syn(C, 'Rock Organ', { o1: o('organ4'), amp: A(0.003, 0.1, 1, 0.06), lfo: LFO('pitch', 0.18, 6.8), drive: 0.55, gain: 0.5 });
  syn(C, 'Soft Flute Organ', { o1: o('organ3'), amp: A(0.01, 0.1, 1, 0.1), gain: 0.6 });
  syn(C, 'Church Organ', { o1: o('pipe'), o2: o('pipe', { oct: -1, lvl: 0.5 }), amp: A(0.06, 0.1, 1, 0.6), gain: 0.45, poly: 16 });
  syn(C, 'Harmonium', { o1: o('reedorgan'), amp: A(0.08, 0.1, 1, 0.3), f: F(4000), lfo: LFO('amp', 0.12, 4.5), gain: 0.55 });
  syn(C, 'Combo Organ', { o1: o('farfisa'), amp: A(0.003, 0.1, 1, 0.05), f: F(6000), lfo: LFO('pitch', 0.2, 6), gain: 0.5 });
  syn(C, 'Calliope', { o1: o('flute'), nz: 0.05, amp: A(0.02, 0.1, 1, 0.1), lfo: LFO('pitch', 0.25, 7), gain: 0.65 });
  syn(C, 'Theatre Organ', { o1: o('organ2'), o2: o('organ3', { oct: 1, lvl: 0.4 }), amp: A(0.02, 0.1, 1, 0.3), lfo: LFO('pitch', 0.35, 6), gain: 0.4 });

  // ------------------------------------------------------------------ Leads
  C = 'Leads';
  syn(C, 'Saw Lead', { o1: o('sawtooth'), o2: o('sawtooth', { fine: 8, lvl: 0.7 }), f: F(3500, 1.5, 1.5, 0.003, 0.3, 0.5, 0.2), amp: A(0.003, 0.2, 0.9, 0.15), gain: 0.55 });
  syn(C, 'Square Lead', { o1: o('square'), o2: o('square', { oct: -1, lvl: 0.4 }), f: F(3000, 1, 1, 0.003, 0.3, 0.5, 0.2), amp: A(0.003, 0.2, 0.9, 0.12), gain: 0.5 });
  syn(C, 'Supersaw Lead', { o1: o('sawtooth', { uni: 7, det: 22 }), o2: o('sawtooth', { uni: 3, oct: 1, lvl: 0.3 }), f: F(6000, 0.8, 0.8, 0.003, 0.3, 0.6, 0.3), amp: A(0.004, 0.3, 0.9, 0.25), gain: 0.5 });
  syn(C, 'Mono Glide Lead', { o1: o('sawtooth'), o2: o('square', { oct: -1, lvl: 0.3 }), f: F(2500, 4, 2, 0.003, 0.3, 0.4, 0.2), amp: A(0.003, 0.2, 0.9, 0.12), mono: 1, glide: 0.08, gain: 0.5 });
  syn(C, 'Sync Lead', { o1: o('bright'), o2: o('buzz', { semi: 7, lvl: 0.4 }), f: F(2000, 2, 2.5, 0.002, 0.25, 0.4, 0.2), amp: A(0.002, 0.2, 0.9, 0.12), gain: 0.45 });
  syn(C, 'Whistle Lead', { o1: o('sine'), nz: 0.03, amp: A(0.03, 0.2, 0.9, 0.12), lfo: LFO('pitch', 0.2, 5.5), gain: 0.65 });
  syn(C, 'Acid Lead', { o1: o('sawtooth'), f: F(600, 14, 3, 0.002, 0.25, 0.1, 0.1, { vel: 1 }), amp: A(0.002, 0.3, 0.8, 0.08), mono: 1, glide: 0.06, drive: 0.3, gain: 0.45 });
  syn(C, 'Trance Lead', { o1: o('sawtooth', { uni: 5, det: 18 }), f: F(1500, 1.2, 3, 0.002, 0.25, 0.25, 0.2), amp: A(0.002, 0.3, 0.7, 0.2), gain: 0.5 });
  syn(C, 'Hoover', { o1: o('sawtooth', { uni: 5, det: 40 }), o2: o('pulse25', { oct: -1, lvl: 0.5, uni: 3, det: 30 }), pe: -5, pt: 0.12, f: F(3000, 1), amp: A(0.01, 0.3, 0.9, 0.3), mono: 1, glide: 0.1, gain: 0.45 });
  syn(C, 'Brass Lead', { o1: o('brass', { uni: 3, det: 10 }), f: F(1400, 1, 2, 0.04, 0.3, 0.6, 0.2, { vel: 1 }), amp: A(0.02, 0.3, 0.9, 0.15), gain: 0.5 });
  syn(C, 'Retro PWM Lead', { o1: o('pulse25', { uni: 3, det: 10 }), f: F(3500, 1, 0.5), lfo: LFO('filter', 0.3, 0.8), amp: A(0.003, 0.2, 0.9, 0.15), gain: 0.5 });
  syn(C, 'Screamer', { o1: o('sawtooth'), o2: o('square', { fine: 12, lvl: 0.5 }), f: F(2000, 3, 0, 0, 0, 0, 0, { t: 'bp' }), amp: A(0.003, 0.2, 0.9, 0.15), drive: 0.75, gain: 0.4 });
  syn(C, 'Soft Sine Lead', { o1: o('sine'), o2: o('triangle', { oct: 1, lvl: 0.2 }), amp: A(0.01, 0.2, 0.9, 0.2), lfo: LFO('pitch', 0.15, 5), gain: 0.7 });
  syn(C, 'FM Lead', { o1: o('sine'), fm: 1.5, fmr: 2, amp: A(0.004, 0.2, 0.9, 0.15), lfo: LFO('pitch', 0.12, 5.5), gain: 0.6 });
  syn(C, 'G-Funk Lead', { o1: o('sine'), o2: o('triangle', { lvl: 0.4 }), f: F(4000), amp: A(0.005, 0.2, 0.9, 0.15), lfo: LFO('pitch', 0.22, 5.5), mono: 1, glide: 0.12, gain: 0.65 });
  syn(C, 'Synthwave Lead', { o1: o('sawtooth', { uni: 3, det: 12 }), o2: o('square', { oct: 1, lvl: 0.25 }), f: F(3000, 1.2, 1, 0.01, 0.4, 0.6, 0.3), amp: A(0.005, 0.3, 0.9, 0.35), lfo: LFO('pitch', 0.1, 5), gain: 0.5 });

  // ------------------------------------------------------------------ Pads
  C = 'Pads';
  syn(C, 'Warm Pad', { o1: o('sawtooth', { uni: 3, det: 12 }), o2: o('sawtooth', { oct: -1, lvl: 0.4 }), f: F(1400, 0.8, 0.7, 0.8, 1.5, 0.5, 1.2), amp: A(0.6, 1, 0.85, 1.2), gain: 0.45, poly: 10 });
  syn(C, 'Glass Pad', { o1: o('glass', { uni: 3, det: 8 }), o2: o('sine', { oct: 1, lvl: 0.3 }), amp: A(0.4, 1, 0.8, 1.5), lfo: LFO('amp', 0.1, 0.3), gain: 0.5, poly: 10 });
  syn(C, 'Choir Pad', { o1: o('vox', { uni: 3, det: 10 }), vowel: 'a', amp: A(0.5, 1, 0.9, 1.2), gain: 0.33, poly: 10 });
  syn(C, 'Dark Pad', { o1: o('sawtooth', { uni: 3, det: 14 }), sub: 0.5, f: F(600, 2), lfo: LFO('filter', 0.5, 0.15), amp: A(0.8, 1, 0.9, 1.5), gain: 0.5, poly: 10 });
  syn(C, 'Sweep Pad', { o1: o('sawtooth', { uni: 5, det: 16 }), f: F(900, 4), lfo: LFO('filter', 0.8, 0.1, { sync: '2/1', w: 'triangle' }), amp: A(0.5, 1, 0.9, 1.2), gain: 0.45, poly: 10 });
  syn(C, 'Supersaw Pad', { o1: o('sawtooth', { uni: 7, det: 25 }), f: F(5000, 0.7), amp: A(0.3, 1, 0.9, 1), gain: 0.35, poly: 10 });
  syn(C, 'Synthwave Pad', { o1: o('sawtooth', { uni: 5, det: 15 }), o2: o('pulse25', { lvl: 0.4 }), f: F(2000, 1, 1, 1, 2, 0.5, 1), amp: A(0.4, 1, 0.9, 1.2), gain: 0.4, poly: 10 });
  syn(C, 'Shimmer Pad', { o1: o('triangle', { uni: 5, det: 8 }), o2: o('sine', { oct: 2, lvl: 0.25 }), amp: A(1.2, 1, 0.9, 2), lfo: LFO('amp', 0.15, 0.4), gain: 0.55, poly: 10 });
  syn(C, 'Bell Pad', { o1: o('sine'), o2: o('sawtooth', { uni: 3, lvl: 0.3 }), fm: 2, fmr: 3.5, fmd: 1.5, f: F(2500), amp: A(0.01, 2, 0.6, 1.5), gain: 0.45, poly: 10 });
  syn(C, 'Lo-fi Tape Pad', { o1: o('warm', { uni: 3, det: 10 }), f: F(1800), lfo: LFO('pitch', 0.15, 0.5), drive: 0.1, amp: A(0.4, 1, 0.9, 1), gain: 0.38, poly: 10 });
  syn(C, 'Evolving Pad', { o1: o('string', { uni: 3, det: 12 }), o2: o('vox', { lvl: 0.5 }), f: F(1500, 3), lfo: LFO('filter', 0.5, 0.07), amp: A(1, 1, 0.9, 2), gain: 0.4, poly: 10 });
  syn(C, 'Air Pad', { o1: o('sine', { uni: 3, det: 10 }), o2: o('triangle', { oct: 1, lvl: 0.3 }), nz: 0.1, f: F(3500, 0.8), amp: A(1, 1, 0.9, 1.5), lfo: LFO('amp', 0.15, 0.3), gain: 0.75, poly: 10 });

  // ------------------------------------------------------------------ Basses
  C = 'Basses';
  syn(C, '808 Bass', { o1: o('sine'), o2: o('triangle', { lvl: 0.12 }), pe: 7, pt: 0.04, amp: A(0.002, 1.5, 0.6, 0.25), mono: 1, glide: 0.07, drive: 0.25, gain: 1 });
  syn(C, '808 Distorted', { o1: o('sine'), pe: 7, pt: 0.04, amp: A(0.002, 1.5, 0.6, 0.25), mono: 1, glide: 0.07, drive: 0.7, gain: 0.85 });
  syn(C, '808 Long Glide', { o1: o('sine'), o2: o('triangle', { lvl: 0.15 }), pe: 5, pt: 0.05, amp: A(0.002, 2.5, 0.8, 0.3), mono: 1, glide: 0.16, drive: 0.35, gain: 0.95 });
  syn(C, '808 Punchy', { o1: o('sine'), pe: 12, pt: 0.03, amp: A(0.001, 0.8, 0.3, 0.2), mono: 1, glide: 0.05, drive: 0.3, gain: 1 });
  syn(C, 'Reese Bass', { o1: o('sawtooth', { uni: 3, det: 24 }), o2: o('sawtooth', { fine: 7, lvl: 0.6 }), sub: 0.4, f: F(600, 2), lfo: LFO('filter', 0.25, 0.2), amp: A(0.005, 0.3, 1, 0.12), mono: 1, glide: 0.03, drive: 0.3, gain: 0.5 });
  syn(C, 'Sub Bass', { o1: o('sine'), o2: o('triangle', { lvl: 0.1 }), amp: A(0.005, 0.2, 1, 0.1), mono: 1, gain: 0.9 });
  syn(C, 'Moog Bass', { o1: o('sawtooth'), o2: o('square', { oct: -1, lvl: 0.6 }), f: F(400, 6, 2.5, 0.002, 0.25, 0.3, 0.1), amp: A(0.002, 0.5, 0.8, 0.1), mono: 1, glide: 0.02, drive: 0.2, gain: 0.6 });
  syn(C, 'Acid Bass 303', { o1: o('sawtooth'), f: F(300, 16, 3.5, 0.002, 0.2, 0.05, 0.1, { vel: 1.2 }), amp: A(0.002, 0.3, 0.85, 0.06), mono: 1, glide: 0.05, drive: 0.35, gain: 0.5 });
  syn(C, 'Wobble Bass', { o1: o('sawtooth', { uni: 3, det: 18 }), o2: o('square', { oct: -1, lvl: 0.6 }), sub: 0.5, f: F(400, 6), lfo: LFO('filter', 1.4, 2, { sync: '1/8' }), amp: A(0.005, 0.3, 1, 0.1), mono: 1, drive: 0.4, gain: 0.5 });
  syn(C, 'FM Bass', { o1: o('sine'), fm: 2.5, fmr: 1, fmd: 0.25, sub: 0.3, amp: A(0.001, 0.4, 0.6, 0.1), mono: 1, gain: 0.75 });
  syn(C, 'Pluck Bass', { o1: o('sawtooth'), o2: o('square', { oct: -1, lvl: 0.4 }), f: F(300, 2, 3, 0.001, 0.15, 0, 0.1), amp: A(0.001, 0.5, 0, 0.1), gain: 0.6 });
  syn(C, 'Finger Bass', { o1: o('pluck'), ks: ks(0.6, 0.3, 2.5, 0.25), f: F(1800), amp: A(0.002, 1, 1, 0.09), gain: 1 });
  syn(C, 'Slap Bass', { o1: o('pluck'), o2: o('square', { lvl: 0.08 }), ks: ks(0.3, 0.9, 2, 0.08), f: F(4000, 1, 1, 0.001, 0.1, 0.4, 0.1), amp: A(0.001, 0.6, 0.4, 0.08), gain: 0.95 });
  syn(C, 'Picked Bass', { o1: o('pluck'), ks: ks(0.45, 0.7, 2.5, 0.1), f: F(3000), amp: A(0.001, 1, 1, 0.08), gain: 1 });
  syn(C, 'Upright Bass', { o1: o('pluck'), ks: ks(0.7, 0.25, 2, 0.3), f: F(1200), amp: A(0.002, 1, 1, 0.12), gain: 1 });
  syn(C, 'Deep House Bass', { o1: o('sine'), o2: o('square', { lvl: 0.3 }), f: F(800, 1.5, 1, 0.002, 0.2, 0.2, 0.1), amp: A(0.002, 0.4, 0.7, 0.08), mono: 1, gain: 0.75 });
  syn(C, 'Juno Bass', { o1: o('pulse25'), sub: 0.6, f: F(900, 1.5, 1.5, 0.002, 0.25, 0.3, 0.1), amp: A(0.002, 0.4, 0.8, 0.08), mono: 1, gain: 0.6 });
  syn(C, 'Growl Bass', { o1: o('sawtooth'), fm: 3, fmr: 0.5, sub: 0.4, f: F(1200, 4), lfo: LFO('filter', 1, 2, { sync: '1/16' }), vowel: 'o', drive: 0.5, amp: A(0.005, 0.3, 1, 0.1), mono: 1, gain: 0.55 });
  syn(C, 'Dub Bass', { o1: o('sine'), o2: o('triangle', { oct: 1, lvl: 0.2 }), f: F(500), amp: A(0.01, 0.3, 0.9, 0.2), mono: 1, gain: 0.9 });
  syn(C, 'Synthwave Bass', { o1: o('sawtooth'), o2: o('sawtooth', { fine: -10, lvl: 0.8 }), f: F(700, 2, 2, 0.002, 0.18, 0.2, 0.1), amp: A(0.002, 0.3, 0.6, 0.08), gain: 0.55 });

  // ------------------------------------------------------------------ Plucks
  C = 'Plucks';
  syn(C, 'Synth Pluck', { o1: o('sawtooth', { uni: 3, det: 10 }), f: F(400, 2, 4, 0.001, 0.18, 0, 0.2), amp: A(0.001, 0.5, 0, 0.2), gain: 0.55 });
  syn(C, 'Future Bass Pluck', { o1: o('sawtooth', { uni: 7, det: 30 }), f: F(1000, 1.5, 3.5, 0.001, 0.25, 0.1, 0.3), amp: A(0.001, 0.6, 0, 0.3), gain: 0.45 });
  syn(C, 'Bell Pluck', { o1: o('sine'), fm: 3, fmr: 3.5, fmd: 0.2, amp: A(0.001, 1, 0, 0.3), gain: 0.65 });
  syn(C, 'House Stab', { o1: o('sawtooth', { uni: 3, det: 12 }), o2: o('sawtooth', { oct: 1, lvl: 0.4 }), f: F(1200, 1.5, 2.5, 0.001, 0.2, 0.1, 0.1), amp: A(0.001, 0.35, 0, 0.15), gain: 0.5 });
  syn(C, 'Harp', { o1: o('pluck'), ks: ks(0.2, 0.5, 3.5, 0.5), f: F(6000), amp: A(0.001, 1, 1, 0.8), gain: 0.85 });
  syn(C, 'Square Pluck', { o1: o('square'), f: F(800, 1.5, 3, 0.001, 0.12, 0, 0.1), amp: A(0.001, 0.4, 0, 0.1), gain: 0.5 });
  syn(C, 'Glass Pluck', { o1: o('glass'), fm: 0.5, fmr: 2, fmd: 0.3, amp: A(0.001, 1.2, 0, 0.4), gain: 0.6 });
  syn(C, 'Water Drop', { o1: o('sine'), pe: 12, pt: 0.03, amp: A(0.001, 0.25, 0, 0.1), gain: 0.7 });
  syn(C, 'Lo-fi Pluck', { o1: o('triangle'), o2: o('sine', { oct: 1, lvl: 0.2 }), f: F(1500), lfo: LFO('pitch', 0.1, 0.8), amp: A(0.001, 0.7, 0, 0.2), drive: 0.2, gain: 0.7 });
  syn(C, 'Chord Stab', { o1: o('sawtooth', { uni: 5, det: 15 }), o2: o('square', { oct: -1, lvl: 0.3 }), f: F(2500, 1, 1.5, 0.001, 0.15, 0.2, 0.1), amp: A(0.001, 0.3, 0.1, 0.1), gain: 0.45 });

  // ------------------------------------------------------------------ Strings
  C = 'Strings';
  syn(C, 'String Ensemble', { o1: o('string', { uni: 5, det: 14 }), o2: o('sawtooth', { oct: -1, lvl: 0.3 }), f: F(3500, 0.7, 0, 0, 0, 0, 0, { kt: 0.3 }), amp: A(0.25, 0.5, 1, 0.5), lfo: LFO('pitch', 0.08, 5), gain: 0.45, poly: 12 });
  syn(C, 'Violin', { o1: o('string'), nz: 0.02, f: F(4500, 1.2), amp: A(0.08, 0.3, 0.95, 0.25), lfo: LFO('pitch', 0.25, 5.8), gain: 0.55 });
  syn(C, 'Viola', { o1: o('string'), nz: 0.02, f: F(3200, 1.1), amp: A(0.09, 0.3, 0.95, 0.25), lfo: LFO('pitch', 0.22, 5.4), gain: 0.55 });
  syn(C, 'Cello', { o1: o('string'), nz: 0.015, f: F(2200, 1), amp: A(0.1, 0.3, 0.95, 0.3), lfo: LFO('pitch', 0.2, 5.2), gain: 0.6 });
  syn(C, 'Contrabass', { o1: o('string'), f: F(900, 1), amp: A(0.1, 0.3, 0.95, 0.3), lfo: LFO('pitch', 0.12, 5), gain: 0.7 });
  syn(C, 'Pizzicato', { o1: o('pluck'), ks: ks(0.5, 0.4, 1, 0.3), f: F(2500), amp: A(0.001, 1, 1, 0.1), gain: 0.9 });
  syn(C, 'Tremolo Strings', { o1: o('string', { uni: 3, det: 12 }), f: F(3000), amp: A(0.1, 0.5, 1, 0.4), lfo: LFO('amp', 0.8, 9), gain: 0.5 });
  syn(C, 'Staccato Strings', { o1: o('string', { uni: 3, det: 10 }), f: F(3200), amp: A(0.01, 0.25, 0, 0.1), gain: 0.55 });
  syn(C, 'Synth Strings', { o1: o('sawtooth', { uni: 5, det: 20 }), o2: o('square', { oct: 1, lvl: 0.2 }), f: F(2800), amp: A(0.3, 0.5, 1, 0.8), lfo: LFO('pitch', 0.1, 5), gain: 0.4 });
  syn(C, 'Cinematic Strings', { o1: o('string', { uni: 5, det: 12 }), o2: o('string', { oct: -1, lvl: 0.4 }), f: F(2500), amp: A(1.2, 1, 1, 1.5), lfo: LFO('pitch', 0.06, 4.5), gain: 0.4 });

  // ------------------------------------------------------------------ Brass
  C = 'Brass';
  syn(C, 'Brass Section', { o1: o('brass', { uni: 3, det: 10 }), f: F(900, 1, 2, 0.06, 0.3, 0.6, 0.2, { vel: 1.5, kt: 0.4 }), amp: A(0.05, 0.3, 0.9, 0.2), gain: 0.5 });
  syn(C, 'Trumpet', { o1: o('brass'), f: F(1200, 1, 2, 0.04, 0.25, 0.7, 0.15, { vel: 1.2, kt: 0.3 }), amp: A(0.03, 0.2, 0.9, 0.12), lfo: LFO('pitch', 0.12, 5.5), gain: 0.55 });
  syn(C, 'Trombone', { o1: o('brass'), f: F(700, 1, 1.6, 0.08, 0.3, 0.6, 0.2, { vel: 1.2 }), amp: A(0.06, 0.3, 0.9, 0.15), gain: 0.6 });
  syn(C, 'French Horn', { o1: o('hollow'), o2: o('brass', { lvl: 0.4 }), f: F(600, 0.8, 1, 0.1, 0.4, 0.7, 0.3), amp: A(0.1, 0.3, 0.95, 0.3), gain: 0.65 });
  syn(C, 'Tuba', { o1: o('brass'), f: F(400, 1, 1.2, 0.06, 0.3, 0.6, 0.2), amp: A(0.05, 0.3, 0.9, 0.15), gain: 0.75 });
  syn(C, 'Synth Brass', { o1: o('sawtooth', { uni: 3, det: 14 }), o2: o('sawtooth', { fine: 10, lvl: 0.7 }), f: F(600, 1.5, 3, 0.08, 0.5, 0.4, 0.3), amp: A(0.02, 0.4, 0.85, 0.3), gain: 0.45 });
  syn(C, 'Brass Stab', { o1: o('brass', { uni: 3, det: 12 }), f: F(1000, 1, 2.5, 0.01, 0.15, 0.3, 0.1), amp: A(0.005, 0.35, 0, 0.1), gain: 0.55 });
  syn(C, 'Muted Trumpet', { o1: o('brass'), f: F(1500, 2, 0, 0, 0, 0, 0, { t: 'bp' }), amp: A(0.03, 0.2, 0.9, 0.12), lfo: LFO('pitch', 0.1, 5), gain: 0.7 });

  // ------------------------------------------------------------------ Woodwinds
  C = 'Woodwinds';
  syn(C, 'Flute', { o1: o('flute'), nz: 0.06, f: F(5000), amp: A(0.06, 0.2, 0.9, 0.15), lfo: LFO('pitch', 0.2, 5), gain: 0.65 });
  syn(C, 'Pan Flute', { o1: o('sine'), nz: 0.12, f: F(3000), pe: -0.4, pt: 0.1, amp: A(0.04, 0.3, 0.8, 0.2), lfo: LFO('pitch', 0.1, 4.5), gain: 0.7 });
  syn(C, 'Clarinet', { o1: o('reed'), f: F(2500, 0.8, 0.5, 0.05, 0.3, 0.8, 0.1), amp: A(0.04, 0.2, 0.95, 0.1), lfo: LFO('pitch', 0.08, 5), gain: 0.55 });
  syn(C, 'Oboe', { o1: o('oboe'), f: F(3500), amp: A(0.04, 0.2, 0.9, 0.1), lfo: LFO('pitch', 0.15, 5.5), gain: 0.55 });
  syn(C, 'Saxophone', { o1: o('sawtooth'), o2: o('reed', { lvl: 0.6 }), f: F(2500, 1, 1, 0.05, 0.3, 0.7, 0.1, { vel: 1 }), amp: A(0.04, 0.2, 0.9, 0.12), lfo: LFO('pitch', 0.15, 5), drive: 0.15, gain: 0.5 });
  syn(C, 'Bassoon', { o1: o('reed'), o2: o('oboe', { lvl: 0.4 }), f: F(900), amp: A(0.05, 0.2, 0.9, 0.12), lfo: LFO('pitch', 0.08, 4.8), gain: 0.65 });
  syn(C, 'Recorder', { o1: o('triangle'), o2: o('flute', { lvl: 0.5 }), nz: 0.02, amp: A(0.03, 0.2, 0.9, 0.1), gain: 0.65 });
  syn(C, 'Piccolo', { o1: o('flute', { oct: 1 }), nz: 0.05, amp: A(0.04, 0.2, 0.9, 0.12), lfo: LFO('pitch', 0.2, 5.5), gain: 0.55 });

  // ------------------------------------------------------------------ Guitars
  C = 'Guitars';
  syn(C, 'Nylon Guitar', { o1: o('pluck'), ks: ks(0.45, 0.45, 3.5, 0.2), f: F(4000), amp: A(0.001, 1, 1, 0.3), gain: 1.17, poly: 12 });
  syn(C, 'Steel Acoustic', { o1: o('pluck'), o2: o('pluck', { fine: 4, lvl: 0.4 }), ks: ks(0.2, 0.8, 4, 0.12), amp: A(0.001, 1, 1, 0.35), gain: 0.98, poly: 12 });
  syn(C, 'Clean Electric', { o1: o('pluck'), ks: ks(0.3, 0.6, 4, 0.15), f: F(3500), amp: A(0.001, 1, 1, 0.2), gain: 1.1 });
  syn(C, 'Muted Guitar', { o1: o('pluck'), ks: ks(0.9, 0.4, 0.5, 0.15), amp: A(0.001, 1, 1, 0.05), gain: 1.23 });
  syn(C, 'Overdrive Guitar', { o1: o('pluck'), ks: ks(0.15, 0.7, 5, 0.12), f: F(3500), amp: A(0.001, 1, 1, 0.15), drive: 0.55, gain: 0.72 });
  syn(C, 'Power Chord Guitar', { o1: o('pluck'), o2: o('pluck', { semi: 7, lvl: 0.6 }), ks: ks(0.15, 0.8, 5, 0.1), f: F(2800), amp: A(0.001, 1, 1, 0.12), drive: 0.9, gain: 0.59 });
  syn(C, 'Funk Guitar', { o1: o('pluck'), ks: ks(0.6, 0.8, 1, 0.1), f: F(1500, 2, 2, 0.001, 0.1, 0.2, 0.1, { t: 'bp' }), amp: A(0.001, 1, 1, 0.06), gain: 1.3 });
  syn(C, 'Banjo', { o1: o('pluck'), ks: ks(0.1, 1, 1.8, 0.05), amp: A(0.001, 1, 1, 0.2), gain: 1.04 });
  syn(C, '12-String Guitar', { o1: o('pluck'), o2: o('pluck', { oct: 1, fine: 3, lvl: 0.5 }), ks: ks(0.25, 0.75, 4, 0.12), amp: A(0.001, 1, 1, 0.3), gain: 0.91 });
  syn(C, 'Jazz Guitar', { o1: o('pluck'), ks: ks(0.7, 0.25, 3, 0.25), f: F(1800), amp: A(0.001, 1, 1, 0.2), gain: 1.3 });

  // ------------------------------------------------------------------ Bells & Mallets
  C = 'Bells & Mallets';
  syn(C, 'Marimba', { o1: o('m:marimba'), amp: A(0.001, 1, 1, 0.3), gain: 0.9 });
  syn(C, 'Xylophone', { o1: o('m:xylo', { oct: 1 }), amp: A(0.001, 1, 1, 0.2), gain: 0.85 });
  syn(C, 'Vibraphone', { o1: o('m:vibes'), amp: A(0.001, 1, 1, 0.8), lfo: LFO('amp', 0.35, 5), gain: 0.85 });
  syn(C, 'Glockenspiel', { o1: o('m:glock', { oct: 1 }), amp: A(0.001, 1, 1, 0.8), gain: 0.7 });
  syn(C, 'Tubular Bells', { o1: o('m:tubular'), amp: A(0.001, 1, 1, 1.5), gain: 0.7 });
  syn(C, 'Church Bell', { o1: o('m:bell', { oct: -1 }), amp: A(0.001, 1, 1, 2), gain: 0.75 });
  syn(C, 'Crystal Bells', { o1: o('m:crystal', { oct: 1 }), amp: A(0.001, 1, 1, 1), gain: 0.7 });
  syn(C, 'Steel Drum', { o1: o('m:steeldrum'), amp: A(0.001, 1, 1, 0.4), gain: 0.85 });
  syn(C, 'Kalimba', { o1: o('m:kalimba'), amp: A(0.001, 1, 1, 0.4), gain: 0.9 });
  syn(C, 'Handpan', { o1: o('m:handpan'), amp: A(0.001, 1, 1, 0.8), gain: 0.85 });
  syn(C, 'FM Bell', { o1: o('sine'), fm: 3, fmr: 3.5, fmd: 2, amp: A(0.001, 3, 0, 1.5), gain: 0.6 });
  syn(C, 'Toy Bell', { o1: o('sine', { oct: 1 }), fm: 1, fmr: 7, fmd: 0.4, amp: A(0.001, 1.2, 0, 0.5), gain: 0.6 });

  // ------------------------------------------------------------------ Choir & Vox
  C = 'Choir & Vox';
  syn(C, 'Choir Aahs', { o1: o('vox', { uni: 5, det: 12 }), vowel: 'a', f: F(4000), amp: A(0.35, 0.5, 0.95, 0.8), lfo: LFO('pitch', 0.1, 5), gain: 0.32 });
  syn(C, 'Choir Oohs', { o1: o('hollow', { uni: 5, det: 12 }), vowel: 'u', amp: A(0.35, 0.5, 0.95, 0.8), lfo: LFO('pitch', 0.1, 5), gain: 0.55 });
  syn(C, 'Female Vox', { o1: o('sawtooth', { uni: 3, det: 8 }), vowel: 'e', amp: A(0.1, 0.3, 0.95, 0.4), lfo: LFO('pitch', 0.2, 5.5), gain: 0.4 });
  syn(C, 'Male Choir', { o1: o('sawtooth', { uni: 5, det: 12 }), vowel: 'o', f: F(3000), amp: A(0.5, 0.5, 0.95, 0.9), lfo: LFO('pitch', 0.08, 4.8), gain: 0.4 });
  syn(C, 'Vox Lead', { o1: o('sawtooth'), vowel: 'a', amp: A(0.03, 0.3, 0.95, 0.2), lfo: LFO('pitch', 0.25, 5.5), mono: 1, glide: 0.06, gain: 0.5 });
  syn(C, 'Talkbox', { o1: o('sawtooth'), o2: o('square', { lvl: 0.4 }), vowel: 'o', f: F(1800, 2, 0, 0, 0, 0, 0, { t: 'bp' }), lfo: LFO('filter', 0.6, 2), amp: A(0.01, 0.3, 0.95, 0.15), mono: 1, glide: 0.05, gain: 0.55 });
  syn(C, 'Whisper Pad', { o1: o('off'), nz: 1, vowel: 'a', amp: A(0.3, 0.5, 0.9, 0.8), gain: 0.7 });
  syn(C, 'Vocal Chop', { o1: o('vox'), vowel: 'a', amp: A(0.005, 0.25, 0, 0.1), gain: 0.6 });
  syn(C, 'Robot Voice', { o1: o('buzz'), o2: o('square', { lvl: 0.4 }), vowel: 'e', amp: A(0.01, 0.2, 0.9, 0.1), gain: 0.75 });

  // ------------------------------------------------------------------ Chiptune
  C = 'Chiptune';
  syn(C, 'Chip Square', { o1: o('square'), amp: A(0.001, 0.1, 0.8, 0.04), vel: 0.3, gain: 0.72 });
  syn(C, 'Chip Pulse 25%', { o1: o('pulse25'), amp: A(0.001, 0.1, 0.8, 0.04), vel: 0.3, gain: 0.81 });
  syn(C, 'Chip Pulse 12%', { o1: o('pulse12'), amp: A(0.001, 0.1, 0.8, 0.04), vel: 0.3, gain: 0.9 });
  syn(C, 'Chip Triangle Bass', { o1: o('nestri'), amp: A(0.001, 0.1, 1, 0.03), vel: 0, gain: 1.05 });
  syn(C, 'Game Boy Wave', { o1: o('gbwave'), amp: A(0.001, 0.1, 1, 0.04), vel: 0.2, gain: 1.08 });
  syn(C, 'Chip Vibrato Lead', { o1: o('pulse25'), lfo: LFO('pitch', 0.3, 6), amp: A(0.001, 0.1, 0.85, 0.05), gain: 0.81 });
  syn(C, 'Chip Bell', { o1: o('pulse12'), amp: A(0.001, 0.4, 0, 0.1), gain: 0.9 });
  syn(C, 'Chip Slide Lead', { o1: o('square'), mono: 1, glide: 0.05, amp: A(0.001, 0.1, 0.85, 0.05), gain: 0.72 });
  syn(C, 'Chip Arp Bass', { o1: o('pulse25'), amp: A(0.001, 0.15, 0.6, 0.03), gain: 0.9 });
  syn(C, 'Chip Power Lead', { o1: o('square'), o2: o('pulse25', { semi: 7, lvl: 0.5 }), amp: A(0.001, 0.1, 0.85, 0.05), gain: 0.63 });

  // ------------------------------------------------------------------ World
  C = 'World';
  syn(C, 'Sitar', { o1: o('pluck'), o2: o('pluck', { oct: 1, lvl: 0.25 }), ks: ks(0.1, 1, 4, 0.03), drive: 0.3, lfo: LFO('pitch', 0.05, 5), amp: A(0.001, 1, 1, 0.4), gain: 0.55 });
  syn(C, 'Koto', { o1: o('pluck'), ks: ks(0.3, 0.8, 2.5, 0.25), pe: -0.4, pt: 0.15, amp: A(0.001, 1, 1, 0.3), gain: 0.85 });
  syn(C, 'Shamisen', { o1: o('pluck'), ks: ks(0.5, 1, 1, 0.08), f: F(5000, 1.5), amp: A(0.001, 1, 1, 0.1), gain: 0.85 });
  syn(C, 'Erhu', { o1: o('string'), vowel: 'e', lfo: LFO('pitch', 0.35, 6), amp: A(0.08, 0.3, 0.95, 0.2), mono: 1, glide: 0.1, gain: 0.5 });
  syn(C, 'Bagpipes', { o1: o('reed'), o2: o('reed', { oct: -1, lvl: 0.5 }), f: F(3000), drive: 0.2, amp: A(0.03, 0.1, 1, 0.1), gain: 0.45 });
  syn(C, 'Ocarina', { o1: o('sine'), nz: 0.03, f: F(2500), lfo: LFO('pitch', 0.15, 5), amp: A(0.03, 0.2, 0.9, 0.12), gain: 0.7 });
  syn(C, 'Shakuhachi', { o1: o('flute'), nz: 0.2, pe: -0.5, pt: 0.15, lfo: LFO('pitch', 0.3, 4.5), amp: A(0.08, 0.3, 0.85, 0.2), gain: 0.65 });
  syn(C, 'Didgeridoo', { o1: o('sawtooth'), vowel: 'o', lfo: LFO('filter', 0.5, 3), f: F(1200, 2), amp: A(0.05, 0.2, 1, 0.2), gain: 0.6 });
  syn(C, 'Gamelan', { o1: o('m:gamelan'), amp: A(0.001, 1, 1, 1), gain: 0.75 });
  syn(C, 'Oud', { o1: o('pluck'), ks: ks(0.45, 0.6, 2.5, 0.3), amp: A(0.001, 1, 1, 0.2), gain: 0.85 });
  syn(C, 'Accordion', { o1: o('reedorgan', { uni: 2, det: 12 }), lfo: LFO('amp', 0.1, 5), amp: A(0.03, 0.1, 1, 0.12), gain: 0.5 });
  syn(C, 'Harmonica', { o1: o('pulse25'), vowel: 'o', lfo: LFO('amp', 0.2, 6), amp: A(0.03, 0.2, 0.9, 0.1), gain: 0.55 });

  // ------------------------------------------------------------------ FX & Risers
  C = 'FX & Risers';
  syn(C, 'Noise Riser', { o1: o('off'), nz: 1, f: F(300, 4, 6, 4, 1, 1, 0.5), amp: A(2, 1, 1, 0.5), gain: 0.5 });
  syn(C, 'Downlifter', { o1: o('sawtooth', { lvl: 0.3 }), nz: 0.8, pe: 24, pt: 2, f: F(3000, 1, -3, 0.01, 2, 0, 0.5), amp: A(0.01, 2, 0.5, 0.5), gain: 0.5 });
  syn(C, 'Laser Zap', { o1: o('square'), pe: 36, pt: 0.12, amp: A(0.001, 0.25, 0, 0.05), gain: 0.4 });
  syn(C, 'Siren', { o1: o('sawtooth'), lfo: LFO('pitch', 6, 0.6, { w: 'triangle' }), f: F(3000), amp: A(0.05, 0.2, 1, 0.3), gain: 0.4 });
  syn(C, 'Sweep Up', { o1: o('sawtooth', { uni: 5, det: 20 }), pe: -24, pt: 3, f: F(400, 2, 4, 3, 1, 1, 0.5), amp: A(1.5, 1, 1, 0.3), gain: 0.4 });
  syn(C, 'Wind', { o1: o('off'), nz: 1, f: F(800, 1.4, 0, 0, 0, 0, 0, { t: 'bp' }), lfo: LFO('filter', 0.8, 0.2), amp: A(0.6, 1, 1, 1.5), gain: 1.4 });
  syn(C, 'Sci-fi Blip', { o1: o('sine'), fm: 6, fmr: 1.5, fmd: 0.1, amp: A(0.001, 0.2, 0, 0.05), gain: 0.5 });
  syn(C, 'UFO', { o1: o('sine'), fm: 1, fmr: 1.01, lfo: LFO('pitch', 2, 8), amp: A(0.2, 0.5, 1, 0.5), gain: 0.5 });
  syn(C, 'Reverse Swell', { o1: o('sawtooth', { uni: 3, det: 15 }), f: F(500, 2, 3, 1.5, 0.1, 1, 0.05), amp: A(1.5, 0.01, 1, 0.04), gain: 0.4 });
  syn(C, 'Alarm', { o1: o('square'), lfo: LFO('pitch', 3, 2, { w: 'square' }), amp: A(0.01, 0.1, 1, 0.05), gain: 0.3 });
  syn(C, 'Noise Hit', { o1: o('off'), nz: 1, f: F(2000, 0.8, 0, 0, 0, 0, 0, { t: 'hp' }), amp: A(0.001, 0.3, 0, 0.1), gain: 0.5 });
  kit(C, 'FX', [['Impact', { type: 'impact', dec: 1 }, 1], ['Reverse Cymbal', { type: 'revcym', dec: 1 }, 0.6], ['Zap', { type: 'zap', dec: 1, tone: 0.3 }, 0.6]]);

  // ------------------------------------------------------------------ drum kits (one channel per drum, FL-style)
  const d = (type, tune, dec, tone, snap, x) => Object.assign({ type, tune: tune || 0, dec: dec == null ? 1 : dec, tone: tone == null ? 0.5 : tone, snap: snap == null ? 0.5 : snap, drive: 0, crush: 0 }, x || {});
  kit('Drums: 808', '808', [['Kick', d('kick', -2, 2.2, 0.3, 0.15), 1], ['Snare', d('snare', 0, 0.9, 0.4, 0.55), 0.75], ['Clap', d('clap', 0, 1, 0.4), 0.7],
    ['Closed Hat', d('hat', 0, 1, 0.2), 0.4, 1], ['Open Hat', d('ohat', 0, 1, 0.2), 0.4, 1], ['Low Tom', d('tom', -5, 1.5), 0.8], ['Mid Tom', d('tom', 0, 1.3), 0.8], ['High Tom', d('tom', 5, 1.1), 0.8],
    ['Cowbell', d('cowbell'), 0.5], ['Rimshot', d('rim'), 0.6], ['Clave', d('clave'), 0.5], ['Cymbal', d('cymbal', 0, 1.3, 0.4), 0.45]]);
  kit('Drums: 909', '909', [['Kick', d('kick', 3, 0.9, 0.7, 0.7, { drive: 0.2 }), 1], ['Snare', d('snare', 3, 0.8, 0.7, 0.8), 0.75], ['Clap', d('clap', 0, 1, 0.6), 0.7],
    ['Closed Hat', d('hat', 2, 1, 0.55), 0.4, 1], ['Open Hat', d('ohat', 2, 1, 0.55), 0.4, 1], ['Ride', d('ride', 0, 1, 0.5), 0.4], ['Crash', d('cymbal', 0, 1.2, 0.7), 0.45],
    ['Low Tom', d('tom', -3, 1.2, 0.5, 0.6), 0.8], ['High Tom', d('tom', 4, 1, 0.5, 0.6), 0.8], ['Rim', d('rim', 2), 0.55]]);
  kit('Drums: Acoustic', 'Acoustic', [['Kick', d('kick', 6, 0.55, 0.8, 0.9, { drive: 0.1 }), 1], ['Snare', d('snare', 5, 1.1, 0.8, 0.85), 0.8], ['Side Stick', d('rim', -3), 0.6],
    ['Closed Hat', d('hat', -2, 1.4, 0.9), 0.38, 1], ['Pedal Hat', d('hat', -3, 0.8, 0.8), 0.32, 1], ['Open Hat', d('ohat', -2, 1.5, 0.9), 0.38, 1], ['Ride', d('ride', -1, 1.3, 0.7), 0.4],
    ['Crash', d('cymbal', 0, 1.2, 0.8), 0.45], ['Floor Tom', d('tom', -7, 1.2, 0.5, 0.6), 0.85], ['Rack Tom', d('tom', 0, 1, 0.5, 0.6), 0.8], ['High Tom', d('tom', 5, 0.9, 0.5, 0.6), 0.8],
    ['Brush Snare', d('brush', 3, 1.2, 0.6, 0.9), 0.6]]);
  kit('Drums: Lo-fi', 'Lo-fi', [['Kick', d('kick', 0, 1, 0.4, 0.5, { crush: 0.5, drive: 0.2 }), 1], ['Snare', d('snare', -2, 0.8, 0.3, 0.6, { crush: 0.55 }), 0.75],
    ['Rim', d('rim', -2, 1, 0.4, 0.5, { crush: 0.5 }), 0.6], ['Hat', d('hat', -3, 1.2, 0.5, 0.5, { crush: 0.5 }), 0.35, 1], ['Open Hat', d('ohat', -3, 0.7, 0.5, 0.5, { crush: 0.5 }), 0.35, 1],
    ['Shaker', d('shaker', 0, 1, 0.4, 0.4, { crush: 0.4 }), 0.4], ['Snap', d('snap', 0, 1, 0.5, 0.5, { crush: 0.3 }), 0.55], ['Vinyl Crackle', d('vinyl', 0, 2), 0.5]]);
  kit('Drums: Trap', 'Trap', [['808 Kick', d('kick', -5, 4.5, 0.2, 0.2, { drive: 0.15 }), 1], ['Punch Kick', d('kick', 4, 0.6, 0.8, 0.8, { drive: 0.4 }), 1],
    ['Snare', d('snare', 6, 0.7, 0.8, 0.9), 0.75], ['Clap', d('clap', 2, 1.2, 0.7), 0.75], ['Hat', d('hat', 4, 0.8, 0.4), 0.35, 1], ['Open Hat', d('ohat', 4, 0.8, 0.4), 0.35, 1],
    ['Rim', d('rim', 3), 0.6], ['Perc', d('block', 2, 1, 0.6), 0.5], ['Snap', d('snap', 1), 0.6]]);
  kit('Drums: House', 'House', [['Kick', d('kick', 1, 1.1, 0.6, 0.6, { drive: 0.3 }), 1], ['Clap', d('clap', 0, 1.4, 0.55), 0.7], ['Closed Hat', d('hat', 1, 1, 0.6), 0.4, 1],
    ['Open Hat', d('ohat', 1, 1.1, 0.7), 0.38, 1], ['Shaker', d('shaker', 0, 1, 0.6), 0.4], ['Ride', d('ride', 1, 1, 0.6), 0.35], ['Snare', d('snare', 2, 0.9, 0.6, 0.7), 0.7]]);
  kit('Drums: Chip', 'Chip', [['Kick', d('chipkick'), 1], ['Snare', d('chipsnare'), 0.75], ['Hat', d('chiphat'), 0.45, 1], ['Open Hat', d('chiphat', 0, 4), 0.45, 1], ['Tom', d('chipkick', 12, 1.5), 0.85]]);
  kit('Percussion', 'Perc', [['Conga High', d('conga', 5), 0.7], ['Conga Low', d('conga', 0), 0.7], ['Bongo High', d('bongo', 3), 0.65], ['Bongo Low', d('bongo', -3), 0.65],
    ['Shaker', d('shaker'), 0.4], ['Tambourine', d('tamb'), 0.45], ['Cowbell', d('cowbell', 0, 1, 0.5), 0.5], ['Woodblock', d('block'), 0.6], ['Triangle', d('triangle'), 0.4],
    ['Agogo', d('agogo'), 0.5], ['Claves', d('clave'), 0.5], ['Timpani', d('timpani'), 0.9], ['Finger Snap', d('snap'), 0.6]]);
  // 2026-11-16: two more kits (Simple mode's Rock and Orchestra), and the drums some kits lacked for 8 Simple lanes
  kit('Drums: Rock', 'Rock', [['Kick', d('kick', 4, 0.7, 0.75, 0.85, { drive: 0.25 }), 1], ['Snare', d('snare', 4, 1.2, 0.85, 0.9, { drive: 0.2 }), 0.8],
    ['Closed Hat', d('hat', -1, 1.3, 0.85), 0.4, 1], ['Open Hat', d('ohat', -1, 1.4, 0.85), 0.4, 1], ['Ride', d('ride', -2, 1.4, 0.75), 0.42], ['Crash', d('cymbal', -1, 1.4, 0.85), 0.5],
    ['Rack Tom', d('tom', 2, 1.1, 0.5, 0.7, { drive: 0.15 }), 0.85], ['Floor Tom', d('tom', -6, 1.3, 0.5, 0.7, { drive: 0.15 }), 0.9], ['Rim', d('rim', 0), 0.6], ['Cowbell', d('cowbell', -1), 0.5]]);
  kit('Drums: Orchestral', 'Orch', [['Bass Drum', d('kick', -9, 3, 0.15, 0.08), 1], ['Snare', d('snare', 2, 0.9, 0.75, 0.95), 0.75], ['Snare Roll', d('sroll', 0, 1, 0.6, 0.5), 0.6],
    ['Cymbals', d('cymbal', -2, 1.8, 0.9), 0.55], ['Timpani Low', d('timpani', -5, 1.2), 0.95], ['Timpani High', d('timpani', 2, 1.1), 0.9], ['Gong', d('gong', 0, 1), 0.8],
    ['Triangle', d('triangle', 0, 1.4), 0.4], ['Suspended Cymbal', d('revcym', 0, 1.2), 0.5]]);
  kit('Drums: Lo-fi', 'Lo-fi', [['Tom', d('tom', -2, 1, 0.4, 0.5, { crush: 0.5 }), 0.75], ['Crash', d('cymbal', -3, 1, 0.5, 0.5, { crush: 0.5 }), 0.4]]);
  kit('Drums: Trap', 'Trap', [['Tom', d('tom', -4, 1.6, 0.4, 0.4, { drive: 0.2 }), 0.85], ['Crash', d('cymbal', 1, 1.1, 0.6), 0.45]]);
  kit('Drums: Chip', 'Chip', [['Clap', d('chipsnare', 5, 0.6), 0.7], ['Blip', d('chipkick', 24, 0.5), 0.6], ['Crash', d('chiphat', -5, 8), 0.4]]);
  kit('Percussion', 'Perc', [['Rainstick', d('shaker', -5, 6, 0.3, 0.1), 0.35]]);

  const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const seen = new Set();
  E.PRESETS = L.map(x => { let id = slug(x.n); while (seen.has(id)) id += '-2'; seen.add(id); return { id, n: x.n, c: x.c, p: x.p }; });
  E.CATEGORIES = [...new Set(E.PRESETS.map(x => x.c))];
  const byId = new Map(E.PRESETS.map(x => [x.id, x]));
  E.presetInfo = id => byId.get(id) || null;
  E.preset = function (id) { const x = byId.get(id); return x ? E.normParams(x.p) : null; };
  // a sensible step-sequencer note for drum channels is middle C (60); synth channels default to C4 too
})(BeatLabEngine);

// Beat Lab engine, part 6: demo projects (E.DEMOS), written with a small builder so they stay readable.
(function (E) {
  'use strict';
  const COLS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#a9e34b', '#3bc9db', '#ff922b'];
  const V = { X: 127, x: 108, o: 76, '-': 48 };
  function build(name, bpm, opt) {
    opt = opt || {};
    const p = { v: 1, name, bpm, sig: opt.sig || [4, 4], swing: opt.swing || 0, key: opt.key || 0, scale: opt.scale || 'minor', ch: [], pat: [], pl: { tr: [], cl: [] }, mix: E.newMixer(opt.inserts || 8), loop: null };
    for (let i = 0; i < 12; i++) p.pl.tr.push({ n: 'Track ' + (i + 1), mute: 0 });
    const B = {
      p,
      ch(preset, o) {
        o = o || {};
        const info = E.presetInfo(preset); if (!info) throw new Error('demo: no preset ' + preset);
        const id = p.ch.length + 1, s = E.preset(preset);
        if (o.s) (function deep(t, x) { for (const k in x) { if (x[k] && typeof x[k] === 'object' && !Array.isArray(x[k])) deep(t[k], x[k]); else t[k] = x[k]; } })(s, o.s);
        p.ch.push({ id, n: o.n || info.n, col: o.col || COLS[(id - 1) % COLS.length], p: preset, s, mix: o.mix || 0, vol: o.vol == null ? 0.8 : o.vol, pan: o.pan || 0, mute: 0, solo: 0, root: o.root || 60 });
        return id;
      },
      pat(n, bars, fn) {
        const id = p.pat.length + 1, steps = bars * E.barTicks(p) / E.STEP;
        const pat = { id, n, len: steps, st: {}, nt: {}, col: COLS[(id * 5) % COLS.length] };
        p.pat.push(pat);
        const h = {
          steps(ch, s) { const a = pat.st[ch] = new Array(steps).fill(0); for (let i = 0; i < steps; i++) a[i] = V[s[i % s.length]] || 0; },
          note(ch, step, len, midi, vel) { (pat.nt[ch] = pat.nt[ch] || []).push([Math.round(step * E.STEP), Math.max(1, Math.round(len * E.STEP)), midi, vel || 100]); },
          notes(ch, list, shift) { for (const n of list) h.note(ch, n[0] + (shift || 0), n[1], n[2], n[3]); },
          chord(ch, step, len, ms, vel, strum) { ms.forEach((m, i) => h.note(ch, step + (strum ? i * strum : 0), len - (strum ? i * strum : 0), m, vel)); }
        };
        fn(h);
        return id;
      },
      clip(pid, track, bar, bars) { const spb = E.barTicks(p) / E.STEP, pat = p.pat[pid - 1]; p.pl.cl.push([pid, track, bar * spb, (bars || pat.len / spb) * spb]); },
      track(i, n, o) { Object.assign(p.mix[i], { n }, o || {}); },
      fx(i, t, prm) { p.mix[i].fx.push({ t, on: 1, p: Object.assign(E.fxDefaults(t), prm || {}) }); },
      tr(i, n) { p.pl.tr[i].n = n; }
    };
    return B;
  }
  E.demoBuilder = build;

  E.DEMOS = [
    { id: 'lofi', n: 'Lo-fi Study Beats', desc: 'Dusty piano chords, a walking upright bass and a swung boom-bap beat at 82 BPM.', make() {
      const B = build('Lo-fi Study Beats', 82, { swing: 45, key: 0, scale: 'major' });
      const kick = B.ch('lo-fi-kick', { mix: 1 }), snare = B.ch('lo-fi-snare', { mix: 1 }), hat = B.ch('lo-fi-hat', { mix: 1, vol: 0.7 }), rim = B.ch('lo-fi-rim', { mix: 1, vol: 0.6 });
      const vin = B.ch('lo-fi-vinyl-crackle', { mix: 1, vol: 0.55 }), keys = B.ch('lo-fi-piano', { mix: 2 }), bass = B.ch('upright-bass', { mix: 3 }), mel = B.ch('vibraphone', { mix: 4, vol: 0.62 });
      B.track(1, 'Drums', { vol: 0.7 }); B.fx(1, 'comp', { th: -20, ra: 3, mk: 2 }); B.fx(1, 'filter', { type: 'lowpass', f: 7000, q: 0.8 });
      B.track(2, 'Keys', { snd: [8, 0.4] }); B.fx(2, 'eq', { lo: -6, hi: -3 });
      B.track(3, 'Bass');
      B.track(4, 'Melody', { snd: [8, 0.5] }); B.fx(4, 'delay', { time: '1/8.', fb: 0.35, mix: 0.22, damp: 3000 });
      B.track(8, 'Reverb'); B.fx(8, 'reverb', { size: 2.8, damp: 4000, lc: 200, mix: 1 });
      B.fx(0, 'eq', { lo: 1.5, hi: -2 });
      const drums = B.pat('Beat', 2, h => {
        h.steps(kick, 'x.........x.....x......x..x.....'); h.steps(snare, '....x.......x...'); h.steps(hat, 'x-o-x-o-x-o-x-ox'); h.steps(rim, '..............o.....o...........'); h.steps(vin, 'x...............');
      });
      const chords = B.pat('Chords', 4, h => {
        [[50, 53, 57, 60, 64], [53, 57, 59, 64], [52, 55, 59, 62], [55, 58, 61, 64]].forEach((c, i) => { h.chord(keys, i * 16, 14, c, 84, 0.25); h.chord(keys, i * 16 + 14, 2, c.slice(1), 60); });
      });
      const bassP = B.pat('Bass', 4, h => h.notes(bass, [[0, 6, 38], [10, 4, 45], [14, 2, 41], [16, 6, 43], [26, 4, 38], [30, 2, 41], [32, 6, 36], [42, 4, 43], [46, 2, 40], [48, 6, 45], [58, 4, 40], [62, 2, 37]]));
      const melP = B.pat('Melody', 4, h => h.notes(mel, [[2, 2, 69, 90], [4, 2, 72], [6, 4, 76, 110], [12, 2, 74], [14, 2, 72], [16, 4, 71, 100], [22, 2, 69], [24, 4, 67], [28, 4, 64, 80],
        [34, 2, 67], [36, 2, 71], [38, 4, 74, 110], [42, 2, 76], [44, 2, 74], [46, 2, 71], [48, 4, 73, 105], [52, 2, 70], [54, 2, 69], [56, 6, 67, 90]]));
      B.tr(0, 'Drums'); B.tr(1, 'Chords'); B.tr(2, 'Bass'); B.tr(3, 'Melody');
      for (let b = 0; b < 24; b += 4) B.clip(chords, 1, b, 4);
      for (let b = 4; b < 20; b += 2) B.clip(drums, 0, b, 2);
      for (let b = 4; b < 20; b += 4) B.clip(bassP, 2, b, 4);
      B.clip(melP, 3, 12, 4); B.clip(melP, 3, 16, 4);
      return B.p;
    } },
    { id: 'trap', n: 'Trap Night', desc: 'Gliding 808s, rolling hi-hats and an icy bell melody at 140 BPM.', make() {
      const B = build('Trap Night', 140, { key: 0, scale: 'minor' });
      const kick = B.ch('trap-punch-kick', { mix: 1 }), clap = B.ch('trap-clap', { mix: 1 }), snare = B.ch('trap-snare', { mix: 1, vol: 0.65 }), hat = B.ch('trap-hat', { mix: 2 }), oh = B.ch('trap-open-hat', { mix: 2, vol: 0.6 });
      const b808 = B.ch('808-long-glide', { mix: 3, n: '808' }), bell = B.ch('bell-pluck', { mix: 4, vol: 0.62 }), pad = B.ch('dark-pad', { mix: 5, vol: 0.55 });
      B.track(1, 'Drums', { vol: 0.72 }); B.fx(1, 'comp', { th: -14, ra: 4, mk: 2 });
      B.track(2, 'Hats'); B.fx(2, 'eq', { lo: -12, hi: 2 });
      B.track(3, '808', { vol: 0.74 }); B.fx(3, 'dist', { mode: 'tube', drive: 0.25, mix: 0.4, out: -2 });
      B.track(4, 'Bells', { snd: [8, 0.45] }); B.fx(4, 'delay', { time: '1/4.', fb: 0.4, mix: 0.25 });
      B.track(5, 'Pad', { snd: [8, 0.65] }); B.fx(5, 'eq', { lo: -10 });
      B.track(8, 'Reverb'); B.fx(8, 'reverb', { size: 3.4, lc: 250, mix: 1 });
      const drums = B.pat('Drums', 2, h => { h.steps(kick, 'x.........x.....x......x..x.....'); h.steps(clap, '........x.......'); h.steps(snare, '........o.......'); });
      const hats = B.pat('Hats', 2, h => {
        for (let s = 0; s < 32; s += 2) if (!(s >= 12 && s < 16) && !(s >= 28)) h.note(hat, s, 1, 60, s % 4 ? 80 : 110);
        for (let k = 0; k < 6; k++) h.note(hat, 12 + k * 2 / 3, 0.6, 60, 70 + k * 6);          // triplet roll
        for (let k = 0; k < 8; k++) h.note(hat, 28 + k * 0.5, 0.5, 60 + k, 60 + k * 7);          // 1/32 roll, rising
        h.note(oh, 22, 2, 60, 90);
      });
      const bass = B.pat('808', 4, h => h.notes(b808, [[0, 7, 36], [7, 4, 36], [10, 6, 43], [16, 7, 36], [23, 3, 36], [26, 2, 39], [28, 4, 36], [32, 7, 32], [39, 4, 32], [42, 6, 39], [48, 7, 31], [55, 4, 31], [58, 6, 38]]));
      const bells = B.pat('Bells', 4, h => h.notes(bell, [[0, 2, 79], [2, 2, 75], [4, 2, 72], [6, 2, 75], [8, 2, 79], [10, 2, 77], [12, 2, 75], [14, 2, 74], [16, 2, 79], [18, 2, 75], [20, 2, 72], [22, 2, 75], [24, 4, 80], [28, 4, 79],
        [32, 2, 80], [34, 2, 75], [36, 2, 72], [38, 2, 75], [40, 2, 80], [42, 2, 79], [44, 2, 77], [46, 2, 75], [48, 2, 79], [50, 2, 74], [52, 2, 71], [54, 2, 74], [56, 4, 79], [60, 4, 74]]));
      const padP = B.pat('Pad', 4, h => { h.chord(pad, 0, 32, [60, 63, 67], 80); h.chord(pad, 32, 16, [56, 60, 63], 80); h.chord(pad, 48, 16, [55, 59, 62], 80); });
      B.tr(0, 'Drums'); B.tr(1, 'Hats'); B.tr(2, '808'); B.tr(3, 'Bells'); B.tr(4, 'Pad');
      B.clip(bells, 3, 0, 4); B.clip(padP, 4, 0, 4);
      for (let b = 4; b < 12; b += 4) { B.clip(bells, 3, b, 4); B.clip(padP, 4, b, 4); B.clip(bass, 2, b, 4); }
      for (let b = 4; b < 12; b += 2) { B.clip(drums, 0, b, 2); B.clip(hats, 1, b, 2); }
      B.clip(bells, 3, 12, 4); B.clip(bass, 2, 12, 4);
      for (let b = 16; b < 24; b += 4) { B.clip(bells, 3, b, 4); B.clip(padP, 4, b, 4); B.clip(bass, 2, b, 4); }
      for (let b = 16; b < 24; b += 2) { B.clip(drums, 0, b, 2); B.clip(hats, 1, b, 2); }
      return B.p;
    } },
    { id: 'synthwave', n: 'Neon Drive', desc: 'Synthwave: pulsing octave bass, a shimmering arp, big pads and a soaring lead at 105 BPM.', make() {
      const B = build('Neon Drive', 105, { key: 9, scale: 'minor' });
      const kick = B.ch('909-kick', { mix: 1 }), snare = B.ch('808-snare', { mix: 2 }), clap = B.ch('808-clap', { mix: 2, vol: 0.6 }), hat = B.ch('909-closed-hat', { mix: 1, vol: 0.65 });
      const tom = B.ch('808-mid-tom', { mix: 2, vol: 0.7 }), bass = B.ch('synthwave-bass', { mix: 3 }), arp = B.ch('juno-keys', { mix: 4, vol: 0.55 }), pad = B.ch('synthwave-pad', { mix: 5, vol: 0.6 }), lead = B.ch('synthwave-lead', { mix: 6, vol: 0.62 });
      B.track(1, 'Kick+Hats'); B.fx(1, 'comp', { th: -16, ra: 4, mk: 2 });
      B.track(2, 'Snare', { snd: [8, 0.55] });
      B.track(3, 'Bass'); B.fx(3, 'eq', { lo: 2, mid: -2 });
      B.track(4, 'Arp'); B.fx(4, 'delay', { time: '1/8.', fb: 0.45, mix: 0.3 }); B.fx(4, 'chorus', { rate: 0.6, mix: 0.4 });
      B.track(5, 'Pad', { snd: [8, 0.5] }); B.fx(5, 'chorus', { rate: 0.4, depth: 0.7, mix: 0.5 });
      B.track(6, 'Lead', { snd: [8, 0.45] }); B.fx(6, 'delay', { time: '1/4', fb: 0.35, mix: 0.25 });
      B.track(8, 'Reverb'); B.fx(8, 'reverb', { size: 3, pre: 0.02, damp: 7000, lc: 200, mix: 1 });
      const roots = [33, 29, 36, 31], chords = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
      const beat = B.pat('Beat', 1, h => { h.steps(kick, 'x.......x.......'); h.steps(snare, '....x.......x...'); h.steps(clap, '....o.......o...'); h.steps(hat, 'x-o-x-o-x-o-x-o-'); });
      const fill = B.pat('Fill', 1, h => { h.steps(kick, 'x.......x.......'); h.steps(snare, '....x.......x.xx'); h.steps(hat, 'x-o-x-o-x-o-....'); h.notes(tom, [[8, 1, 67], [9, 1, 67], [10, 1, 62], [11, 1, 62], [12, 1, 57], [13, 1, 57]]); });
      const bassP = B.pat('Bass', 4, h => { for (let b = 0; b < 4; b++) for (let s = 0; s < 16; s += 2) h.note(bass, b * 16 + s, 1.6, roots[b] + (s % 4 ? 12 : 0), s % 4 ? 90 : 115); });
      const arpP = B.pat('Arp', 4, h => { const ord = [0, 1, 2, 3, 2, 1, 0, 1]; for (let b = 0; b < 4; b++) { const c = chords[b].map(m => m + 12).concat([chords[b][0] + 24]); for (let s = 0; s < 16; s++) h.note(arp, b * 16 + s, 1, c[ord[s % 8]], s % 4 ? 80 : 105); } });
      const padP = B.pat('Pad', 4, h => chords.forEach((c, b) => h.chord(pad, b * 16, 16, [roots[b] + 12].concat(c), 85)));
      const leadP = B.pat('Lead', 4, h => h.notes(lead, [[0, 6, 76], [6, 2, 74], [8, 4, 72], [12, 4, 71], [16, 8, 69], [24, 4, 72], [28, 4, 74], [32, 6, 76], [38, 2, 79], [40, 4, 76], [44, 4, 74], [48, 12, 74], [60, 4, 71]]));
      B.tr(0, 'Drums'); B.tr(1, 'Bass'); B.tr(2, 'Arp'); B.tr(3, 'Pad'); B.tr(4, 'Lead');
      for (let b = 0; b < 24; b += 4) B.clip(padP, 3, b, 4);
      for (let b = 0; b < 24; b += 4) B.clip(arpP, 2, b, 4);
      for (let b = 4; b < 24; b += 4) B.clip(bassP, 1, b, 4);
      for (let b = 4; b < 24; b++) B.clip((b % 4 === 3) ? fill : beat, 0, b, 1);
      for (let b = 12; b < 24; b += 4) B.clip(leadP, 4, b, 4);
      return B.p;
    } },
    { id: 'house', n: 'Sunset House', desc: 'Four-to-the-floor 909s, offbeat bass and deep piano chords at 124 BPM, with a breakdown.', make() {
      const B = build('Sunset House', 124, { key: 5, scale: 'minor' });
      const kick = B.ch('house-kick', { mix: 1 }), clap = B.ch('house-clap', { mix: 2 }), hat = B.ch('house-closed-hat', { mix: 2, vol: 0.6 }), oh = B.ch('house-open-hat', { mix: 2, vol: 0.65 }), shk = B.ch('house-shaker', { mix: 2, vol: 0.5 });
      const bass = B.ch('deep-house-bass', { mix: 3 }), piano = B.ch('grand-piano', { mix: 4, vol: 0.68 }), pad = B.ch('warm-pad', { mix: 5, vol: 0.55 }), stab = B.ch('house-stab', { mix: 4, vol: 0.5 });
      B.track(1, 'Kick'); B.track(2, 'Tops', { snd: [8, 0.2] }); B.fx(2, 'eq', { lo: -8, hi: 1 });
      B.track(3, 'Bass'); B.fx(3, 'comp', { th: -18, ra: 4, mk: 3 });
      B.track(4, 'Keys', { snd: [8, 0.35] }); B.fx(4, 'eq', { lo: -6, mid: 1 });
      B.track(5, 'Pad', { snd: [8, 0.6] }); B.fx(5, 'filter', { type: 'lowpass', f: 2500, q: 2, lr: '1/1', ld: 0.3 });
      B.track(8, 'Reverb'); B.fx(8, 'reverb', { size: 2.6, lc: 250, mix: 1 });
      B.fx(0, 'comp', { th: -10, ra: 2, at: 0.02, mk: 1 });
      const ch = [[56, 60, 63, 67], [53, 56, 60, 63], [55, 58, 63, 65], [55, 58, 63, 67]], rt = [41, 37, 39, 36];
      const drums = B.pat('Drums', 1, h => { h.steps(kick, 'x...x...x...x...'); h.steps(clap, '....x.......x...'); h.steps(hat, 'o.o.o.o.o.o.o.o.'); h.steps(oh, '..x...x...x...x.'); h.steps(shk, 'xoxoxoxoxoxoxoxo'); });
      const intro = B.pat('Kick + Hats', 1, h => { h.steps(kick, 'x...x...x...x...'); h.steps(oh, '..x...x...x...x.'); });
      const bassP = B.pat('Bass', 4, h => { for (let b = 0; b < 4; b++) { h.note(bass, b * 16 + 2, 2, rt[b], 110); h.note(bass, b * 16 + 6, 2, rt[b], 95); h.note(bass, b * 16 + 10, 2, rt[b] + 12, 100); h.note(bass, b * 16 + 14, 2, rt[b], 95); } });
      const pianoP = B.pat('Piano', 4, h => ch.forEach((c, b) => { h.chord(piano, b * 16, 3, c, 100); h.chord(piano, b * 16 + 3, 3, c, 88); h.chord(piano, b * 16 + 10, 4, c, 96); }));
      const padP = B.pat('Pad', 4, h => ch.forEach((c, b) => h.chord(pad, b * 16, 16, c, 80)));
      const stabP = B.pat('Stabs', 4, h => ch.forEach((c, b) => { h.chord(stab, b * 16 + 2, 1, c.map(m => m + 12), 100); h.chord(stab, b * 16 + 7, 1, c.map(m => m + 12), 90); h.chord(stab, b * 16 + 12, 1, c.map(m => m + 12), 95); }));
      B.tr(0, 'Drums'); B.tr(1, 'Bass'); B.tr(2, 'Piano'); B.tr(3, 'Pad'); B.tr(4, 'Stabs');
      for (let b = 0; b < 8; b++) B.clip(intro, 0, b, 1);
      for (let b = 8; b < 24; b++) B.clip(drums, 0, b, 1);
      for (let b = 8; b < 24; b += 4) B.clip(bassP, 1, b, 4);
      for (let b = 16; b < 24; b += 4) B.clip(pianoP, 2, b, 4);
      for (let b = 24; b < 32; b += 4) { B.clip(padP, 3, b, 4); B.clip(pianoP, 2, b, 4); }
      for (let b = 32; b < 48; b++) B.clip(drums, 0, b, 1);
      for (let b = 32; b < 48; b += 4) { B.clip(bassP, 1, b, 4); B.clip(pianoP, 2, b, 4); B.clip(stabP, 4, b, 4); }
      return B.p;
    } },
    { id: 'orchestral', n: 'Heroes\' Theme', desc: 'Orchestral: strings, brass, harp, choir and timpani, with a shared hall reverb on a send.', make() {
      const B = build('Heroes\' Theme', 84, { key: 2, scale: 'minor' });
      const str = B.ch('cinematic-strings', { mix: 1, vol: 0.7 }), bass = B.ch('contrabass', { mix: 1, vol: 0.75 }), harp = B.ch('harp', { mix: 2, vol: 0.62 }), brass = B.ch('brass-section', { mix: 3, vol: 0.68 });
      const choir = B.ch('choir-aahs', { mix: 4, vol: 0.55 }), glock = B.ch('glockenspiel', { mix: 2, vol: 0.45 }), timp = B.ch('perc-timpani', { mix: 5, vol: 0.85 }), crash = B.ch('acoustic-crash', { mix: 5, vol: 0.45 });
      B.track(1, 'Strings', { snd: [8, 0.5] }); B.track(2, 'Harp + Glock', { snd: [8, 0.55] }); B.track(3, 'Brass', { snd: [8, 0.45] }); B.fx(3, 'eq', { mid: 1.5, hi: -2 });
      B.track(4, 'Choir', { snd: [8, 0.6] }); B.track(5, 'Percussion', { snd: [8, 0.35] });
      B.track(8, 'Hall Reverb'); B.fx(8, 'reverb', { size: 4.5, pre: 0.03, damp: 5000, lc: 200, mix: 1 });
      const C8 = [[50, 57, 62, 65], [50, 58, 62, 65], [48, 57, 60, 65], [48, 55, 60, 64], [50, 57, 62, 65], [50, 58, 62, 65], [50, 55, 58, 62], [49, 57, 61, 64]];
      const R8 = [38, 34, 41, 36, 38, 34, 43, 33];
      const theme = [[0, 4, 62], [4, 2, 65], [6, 2, 69], [8, 8, 74], [16, 4, 74], [20, 4, 72], [24, 4, 70], [28, 4, 69], [32, 6, 69], [38, 2, 72], [40, 8, 77], [48, 4, 76], [52, 4, 74], [56, 8, 72],
        [64, 4, 69], [68, 2, 74], [70, 2, 77], [72, 8, 81], [80, 4, 79], [84, 4, 77], [88, 4, 74], [92, 4, 70], [96, 6, 70], [102, 2, 74], [104, 8, 79], [112, 8, 76], [120, 8, 73]];
      const base = h => {
        C8.forEach((c, b) => { h.chord(str, b * 16, 8, c, 92); h.chord(str, b * 16 + 8, 8, c, 84); h.note(bass, b * 16, 16, R8[b], 100); });
        C8.forEach((c, b) => { const t = [c[1], c[2], c[3], c[1] + 12, c[2] + 12, c[3] + 12, c[1] + 24, c[3] + 12]; t.forEach((m, k) => h.note(harp, b * 16 + k * 2, 2, m, 70 + (k % 4 === 0 ? 20 : 0))); });
        for (let b = 0; b < 8; b++) h.note(timp, b * 16, 4, b === 7 ? 57 : 62, b % 4 === 0 ? 120 : 95);
        for (let k = 0; k < 8; k++) h.note(timp, 120 + k * 0.5, 0.5, 57, 60 + k * 8);
      };
      const A = B.pat('Theme (quiet)', 8, h => base(h));
      const Bp = B.pat('Theme (full)', 8, h => {
        base(h); h.notes(brass, theme); h.notes(glock, theme.slice(14).map(n => [n[0], n[1], n[2] + 12, 80]));
        C8.forEach((c, b) => h.chord(choir, b * 16, 16, c.slice(1).map(m => m + 12), 85)); h.note(crash, 0, 4, 60, 110); h.note(crash, 64, 4, 60, 100);
      });
      const end = B.pat('Ending', 2, h => { h.chord(str, 0, 32, [38, 50, 57, 62, 65, 69], 100); h.chord(brass, 0, 24, [62, 65, 69], 100); h.chord(choir, 0, 32, [62, 69, 74], 90); h.note(timp, 0, 8, 62, 127); h.note(crash, 0, 8, 60, 120); h.note(bass, 0, 32, 26, 110); });
      B.tr(0, 'Orchestra');
      B.clip(A, 0, 0, 8); B.clip(Bp, 0, 8, 8); B.clip(Bp, 0, 16, 8); B.clip(end, 0, 24, 2);
      return B.p;
    } },
    { id: 'chip', n: 'Pixel Quest', desc: 'Chiptune: square-wave melody, triangle bass and fast arpeggios at 150 BPM.', make() {
      const B = build('Pixel Quest', 150, { key: 0, scale: 'major' });
      const kick = B.ch('chip-kick', { mix: 1 }), snare = B.ch('chip-snare', { mix: 1 }), hat = B.ch('chip-hat', { mix: 1, vol: 0.6 });
      const lead = B.ch('chip-pulse-25', { mix: 2, vol: 0.6 }), bass = B.ch('chip-triangle-bass', { mix: 3 }), arp = B.ch('chip-pulse-12', { mix: 4, vol: 0.4 });
      B.track(1, 'Noise'); B.track(2, 'Pulse 1'); B.fx(2, 'delay', { time: '1/8', fb: 0.25, mix: 0.18, pp: 'off' }); B.track(3, 'Triangle'); B.track(4, 'Pulse 2');
      const prog = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], roots = [36, 33, 29, 31];
      const drums = B.pat('Drums', 1, h => { h.steps(kick, 'x.....x...x.....'); h.steps(snare, '....x.......x...'); h.steps(hat, 'x.x.x.x.x.x.x.xx'); });
      const bassP = B.pat('Bass', 4, h => { for (let b = 0; b < 4; b++) for (let s = 0; s < 16; s += 2) h.note(bass, b * 16 + s, 1.5, roots[b] + ([0, 12, 7, 12][(s / 2) % 4]), 100); });
      const arpP = B.pat('Arp', 4, h => { for (let b = 0; b < 4; b++) for (let s = 0; s < 16; s++) h.note(arp, b * 16 + s, 1, prog[b][s % 3] + 12, 90); });
      const leadP = B.pat('Melody', 4, h => h.notes(lead, [[0, 2, 72], [2, 2, 76], [4, 2, 79], [6, 4, 84], [10, 2, 83], [12, 4, 79], [16, 2, 81], [18, 2, 79], [20, 2, 76], [22, 4, 72], [26, 2, 74], [28, 4, 76],
        [32, 2, 77], [34, 2, 76], [36, 2, 74], [38, 4, 72], [42, 2, 69], [44, 4, 72], [48, 2, 74], [50, 2, 76], [52, 2, 77], [54, 2, 79], [56, 8, 83]]));
      B.tr(0, 'Drums'); B.tr(1, 'Bass'); B.tr(2, 'Arp'); B.tr(3, 'Melody');
      for (let b = 0; b < 16; b += 4) { B.clip(bassP, 1, b, 4); B.clip(arpP, 2, b, 4); }
      for (let b = 4; b < 16; b++) B.clip(drums, 0, b, 1);
      B.clip(leadP, 3, 8, 4); B.clip(leadP, 3, 12, 4);
      return B.p;
    } }
  ];
  E.demo = function (id) { const d = E.DEMOS.find(x => x.id === id); return d ? E.normalize(d.make()) : null; };
})(BeatLabEngine);

// Beat Lab engine, part 7: Simple-mode songs. A simple song is a grid (notes stored as [column, scale row], drums as
// [column, lane], format below); E.fromSimple turns one into a normal one-pattern project, and E.fromSave turns anything Beat Lab
// saved (localStorage beatlab_p_<id>) into a project the engine can play.
(function (E) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  E.SCALES = {
    major: { n: 'Major', s: [0, 2, 4, 5, 7, 9, 11] }, minor: { n: 'Minor', s: [0, 2, 3, 5, 7, 8, 10] },
    pentatonic: { n: 'Pentatonic', s: [0, 2, 4, 7, 9] }, minpent: { n: 'Minor pentatonic', s: [0, 3, 5, 7, 10] },
    blues: { n: 'Blues', s: [0, 3, 5, 6, 7, 10] }, dorian: { n: 'Dorian', s: [0, 2, 3, 5, 7, 9, 10] },
    mixolydian: { n: 'Mixolydian', s: [0, 2, 4, 5, 7, 9, 10] }, harmonic: { n: 'Harmonic minor', s: [0, 2, 3, 5, 7, 8, 11] },
    phrygian: { n: 'Phrygian', s: [0, 1, 3, 5, 7, 8, 10] }, lydian: { n: 'Lydian', s: [0, 2, 4, 6, 7, 9, 11] },
    chromatic: { n: 'Chromatic', s: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
  };
  // A simple song (format of 2026-11-16; older songs are migrated by E.simpleNormalize, and play exactly as before):
  //   { key, scale, oct, range, bars, beats, split, bpm, echo, swing, kit, dv: 2,
  //     ly: [{ inst, mel: [[column, scale row, art?]], vol: 0..1 (0.8 = unity), mute, dbl: '' | second instrument }]  (1-4 layers),
  //     cur: the layer being edited, drm: [[column, lane 0-7, art?]] }   art: an E.ARTS id
  //   Before: one instrument (inst + mel) and 4 drum lanes (kick, snare, hat, clap) = today's lanes 0, 1, 2, 4.
  E.SIMPLE_DEF = { key: 0, scale: 'major', oct: 4, range: 2, kit: 'electronic', bars: 4, beats: 4, split: 2, bpm: 110, echo: 1, swing: 0, drm: [], cur: 0 };
  E.SIMPLE_LAYER = { inst: 'piano', mel: [], vol: 0.8, mute: 0, dbl: '' };
  E.SIMPLE_MAX_LAYERS = 4;
  E.SIMPLE_INST = [
    { id: 'piano', n: 'Piano', p: 'grand-piano' }, { id: 'marimba', n: 'Marimba', p: 'marimba' }, { id: 'guitar', n: 'Guitar', p: 'nylon-guitar' },
    { id: 'strings', n: 'Strings', p: 'string-ensemble' }, { id: 'flute', n: 'Flute', p: 'flute' }, { id: 'synth', n: 'Synth', p: 'juno-keys' },
    { id: 'choir', n: 'Choir', p: 'choir-aahs' }, { id: 'bells', n: 'Bells', p: 'glockenspiel' }, { id: 'chip', n: '8-bit', p: 'chip-pulse-25' }, { id: 'bass', n: 'Bass', p: 'finger-bass' }
  ];
  // 8 drum lanes per kit; lanes 0, 1, 2 and 4 are the sounds the 4-lane kits had (so old songs sound the same)
  E.SIMPLE_LANES = ['Kick', 'Snare', 'Closed hat', 'Open hat', 'Clap', 'Tom', 'Perc', 'Crash'];
  const kit = (id, n, p, names) => ({ id, n, p, ln: E.SIMPLE_LANES.map((x, i) => (names && names[i]) || x) });
  E.SIMPLE_KITS = [
    kit('electronic', 'Electronic', ['808-kick', '808-snare', '808-closed-hat', '808-open-hat', '808-clap', '808-mid-tom', '808-cowbell', '808-cymbal'], { 6: 'Cowbell' }),
    kit('acoustic', 'Acoustic', ['acoustic-kick', 'acoustic-snare', 'acoustic-closed-hat', 'acoustic-open-hat', 'acoustic-side-stick', 'acoustic-rack-tom', 'acoustic-ride', 'acoustic-crash'], { 4: 'Side stick', 6: 'Ride' }),
    kit('rock', 'Rock', ['rock-kick', 'rock-snare', 'rock-closed-hat', 'rock-open-hat', 'rock-floor-tom', 'rock-rack-tom', 'rock-ride', 'rock-crash'], { 4: 'Floor tom', 5: 'Rack tom', 6: 'Ride' }),
    kit('lofi', 'Lo-fi', ['lo-fi-kick', 'lo-fi-snare', 'lo-fi-hat', 'lo-fi-open-hat', 'lo-fi-rim', 'lo-fi-tom', 'lo-fi-shaker', 'lo-fi-crash'], { 4: 'Rim', 6: 'Shaker' }),
    kit('trap', 'Trap', ['trap-808-kick', 'trap-snare', 'trap-hat', 'trap-open-hat', 'trap-clap', 'trap-tom', 'trap-perc', 'trap-crash']),
    kit('house', 'House', ['house-kick', 'house-snare', 'house-closed-hat', 'house-open-hat', 'house-clap', '909-low-tom', 'house-shaker', '909-crash'], { 6: 'Shaker' }),
    kit('latin', 'Bongos', ['perc-conga-low', 'perc-conga-high', 'perc-shaker', 'perc-tambourine', 'perc-cowbell', 'perc-bongo-high', 'perc-woodblock', 'perc-agogo'], ['Conga low', 'Conga high', 'Shaker', 'Tambourine', 'Cowbell', 'Bongo', 'Woodblock', 'Agogo']),
    kit('world', 'World', ['perc-bongo-low', 'perc-bongo-high', 'perc-shaker', 'perc-tambourine', 'perc-claves', 'perc-conga-low', 'perc-cowbell', 'perc-triangle'], ['Bongo low', 'Bongo high', 'Shaker', 'Tambourine', 'Claves', 'Conga', 'Cowbell', 'Triangle']),
    kit('orchestra', 'Orchestra', ['orch-bass-drum', 'orch-snare', 'orch-triangle', 'orch-suspended-cymbal', 'orch-snare-roll', 'orch-timpani-low', 'orch-timpani-high', 'orch-cymbals'], ['Bass drum', 'Snare', 'Triangle', 'Swell', 'Snare roll', 'Timpani low', 'Timpani high', 'Cymbals']),
    kit('chip', '8-bit', ['chip-kick', 'chip-snare', 'chip-hat', 'chip-open-hat', 'chip-tom', 'chip-clap', 'chip-blip', 'chip-crash'], { 4: 'Tom', 5: 'Clap', 6: 'Blip' })
  ];
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  E.simpleNormalize = function (s) {
    s = isObj(s) ? s : {};
    if (!Array.isArray(s.ly)) s.ly = [{ inst: s.inst, mel: Array.isArray(s.mel) ? s.mel : [] }];      // one instrument -> layer 1
    delete s.inst; delete s.mel;
    if (!s.dv) {                                                                                   // 4 drum lanes -> 8: clap moves to lane 4
      if (Array.isArray(s.drm)) s.drm = s.drm.map(x => Array.isArray(x) && x[1] === 3 ? [x[0], 4].concat(x.slice(2)) : x);
      s.dv = 2;
    }
    E.fill(s, E.SIMPLE_DEF);
    if (!E.SCALES[s.scale]) s.scale = 'major';
    s.bars = clamp(s.bars | 0, 1, 16); s.beats = clamp(s.beats | 0, 2, 7); s.split = clamp(s.split | 0, 1, 4); s.range = clamp(s.range | 0, 1, 3); s.oct = clamp(s.oct | 0, 2, 6);
    s.bpm = clamp(s.bpm | 0, 40, 220); s.key = clamp(s.key | 0, 0, 11);
    if (!E.SIMPLE_KITS.some(x => x.id === s.kit)) s.kit = 'electronic';
    s.ly = s.ly.filter(isObj).slice(0, E.SIMPLE_MAX_LAYERS);
    if (!s.ly.length) s.ly.push({});
    for (const L of s.ly) {
      E.fill(L, E.SIMPLE_LAYER);
      if (!Array.isArray(L.mel)) L.mel = [];
      if (!E.SIMPLE_INST.some(x => x.id === L.inst)) L.inst = 'piano';
      if (L.dbl && !E.SIMPLE_INST.some(x => x.id === L.dbl)) L.dbl = '';
      L.vol = clamp(+L.vol || 0, 0, 1); L.mute = L.mute ? 1 : 0;
    }
    s.cur = clamp(s.cur | 0, 0, s.ly.length - 1);
    if (!Array.isArray(s.drm)) s.drm = [];
    return s;
  };
  E.simpleLayer = s => s.ly[s.cur] || s.ly[0];
  E.simpleCols = s => s.bars * s.beats * s.split;
  E.simpleRows = s => E.SCALES[s.scale].s.length * s.range + 1;
  E.simpleMidi = (s, r) => { const sc = E.SCALES[s.scale].s, n = sc.length; return 12 * (s.oct + 1) + s.key + sc[r % n] + 12 * Math.floor(r / n); };
  // add a channel playing a library preset to a project
  E.addChannel = function (p, presetId, o) {
    const info = E.presetInfo(presetId) || E.presetInfo('saw-lead');
    const id = p.ch.reduce((m, c) => Math.max(m, +c.id || 0), 0) + 1;
    const COLS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#a9e34b', '#3bc9db', '#ff922b'];
    const c = Object.assign({ id, n: info.n, col: COLS[(id - 1) % COLS.length], p: info.id, s: E.normParams(info.p), mix: 0, vol: 0.8, pan: 0, mute: 0, solo: 0, root: 60 }, o || {});
    p.ch.push(c);
    return c;
  };
  E.fromSimple = function (s, name) {
    s = E.simpleNormalize(E.clone(s));
    const PPQ = E.PPQ, STEP = E.STEP, tpc = PPQ / s.split, steps = s.bars * s.beats * 4, cols = E.simpleCols(s), rows = E.simpleRows(s);
    // swing: 16ths swing in the engine; with beats split in two the off-beat 8ths are pushed late here instead
    const sw8 = s.swing && s.split === 2, at = c => Math.round(c * tpc) + (sw8 && c % 2 ? 8 : 0), len = c => Math.round(tpc) - (sw8 && c % 2 ? 8 : 0);
    const p = E.normalize({ name: name || 'Song', bpm: s.bpm, sig: [s.beats, 4], swing: s.swing && s.split === 4 ? 55 : 0, key: s.key, scale: s.scale, mix: E.newMixer(3) });
    const kit = E.SIMPLE_KITS.find(x => x.id === s.kit), pat = p.pat[0], map = { mel: [], drm: [] };
    pat.len = steps; pat.n = 'Song';
    for (const L of s.ly) {                        // each layer is a channel (a doubled layer two), all on mixer track 1
      const inst = E.SIMPLE_INST.find(x => x.id === L.inst);
      const melody = E.addChannel(p, inst.p, { n: inst.n, mix: 1, vol: L.vol, mute: L.mute });
      const notes = L.mel.filter(([c, r]) => c < cols && r < rows).map(([c, r, a]) => { const n = [at(c), len(c), E.simpleMidi(s, r), 100]; if (a && E.ART[a]) n.push(a); return n; }).sort((a, b) => a[0] - b[0]);
      pat.nt[melody.id] = notes;
      const ids = [melody.id];
      if (L.dbl) {
        const i2 = E.SIMPLE_INST.find(x => x.id === L.dbl), dbl = E.addChannel(p, i2.p, { n: i2.n + ' (double)', mix: 1, vol: L.vol * 0.85, mute: L.mute });
        pat.nt[dbl.id] = notes.map(n => n.slice()); ids.push(dbl.id);
      }
      map.mel.push(ids);
    }
    const drums = kit.p.map((pid, i) => E.addChannel(p, pid, { n: kit.ln[i], mix: 2, vol: i === 2 || i === 3 || i === 7 ? 0.7 : 0.8 }));
    p.mix[1].n = 'Melody'; p.mix[2].n = 'Drums';
    if (s.echo) {                                  // one shared reverb (a send bus) keeps it light on slow computers
      p.mix[3].n = 'Echo'; p.mix[3].fx.push({ t: 'reverb', on: 1, p: Object.assign(E.fxDefaults('reverb'), { size: 2.4, lc: 200, mix: 1 }) });
      p.mix[1].snd = [3, 0.42]; p.mix[2].snd = [3, 0.14];
    }
    p.mix[2].fx.push({ t: 'comp', on: 1, p: Object.assign(E.fxDefaults('comp'), { th: -16, ra: 3, mk: 2 }) });
    drums.forEach((ch, lane) => {
      map.drm.push(ch.id);
      const hits = s.drm.filter(([c, l]) => l === lane && c < cols);
      if (tpc % STEP === 0 && !sw8) {
        const st = pat.st[ch.id] = new Array(steps).fill(0);
        for (const [c, , a] of hits) {
          const i = Math.round(c * tpc / STEP); st[i] = (c * tpc) % PPQ === 0 ? 112 : 96;
          if (a && E.ART[a]) { pat.sa = pat.sa || {}; (pat.sa[ch.id] = pat.sa[ch.id] || new Array(steps).fill(0))[i] = a; }
        }
      } else pat.nt[ch.id] = hits.map(([c, , a]) => { const n = [at(c), len(c), 60, (c * tpc) % PPQ === 0 ? 112 : 96]; if (a && E.ART[a]) n.push(a); return n; }).sort((a, b) => a[0] - b[0]);
    });
    Object.defineProperty(p, 'smap', { value: map, enumerable: false });     // layer -> channel ids, lane -> channel id (for the UI)
    p.pl.cl = [[pat.id, 0, 0, steps]];
    return p;
  };
  // anything Beat Lab saved -> a playable project (simple songs are converted, studio projects get their defaults)
  E.fromSave = function (saved) {
    const o = typeof saved === 'string' ? JSON.parse(saved) : saved;
    if (!o || typeof o !== 'object') return null;
    return o.mode === 'simple' ? E.fromSimple(o.simple, o.name) : E.normalize(E.clone(o));
  };
})(BeatLabEngine);
