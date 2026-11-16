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
//     pat: [{ id, n: name, len: steps, st: { chId: [velocity 0-127 per step] }, nt: { chId: [[tick, len, midi, vel 1-127]] } }],
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
      if (st) for (let i = 0, n = Math.min(st.length, pat.len); i < n; i++) if (st[i] > 0) out.push({ t: i * STEP, d: STEP, c: ch.id, n: ch.root || 60, v: st[i] / 127, sw: i & 1 });
      const nt = pat.nt && pat.nt[ch.id];
      if (nt) for (const n of nt) if (n[0] < len) out.push({ t: n[0], d: Math.max(1, n[1]), c: ch.id, n: n[2], v: (n[3] || 100) / 127, sw: n[0] % 24 === 12 ? 1 : 0 });
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
        out.push({ t, d: Math.min(e.d, end - t), c: e.c, n: e.n, v: e.v, sw: e.sw });
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
  P._fire = function (chId, midi, vel, t, dur) {
    const c = this.ch.get(chId);
    if (!c || !c.s) return null;
    if (c.muted && chId !== '__pv' && dur != null) return null;
    let v = null;
    try { v = E.voiceStart(this, c, midi, vel, t, dur); } catch (e) { report('note', e); }
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
  P.hit = function (chId, midi, vel, dur) {          // one short note on a project channel, now
    this.audio();
    return this._fire(chId, midi, vel == null ? 0.8 : vel, this.ctx.currentTime + 0.005, dur == null ? 0.3 : dur);
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
            this._fire(e.c, e.n, e.v, time - this._virt, e.d * spt);
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
    const until = tEnd => { for (; i < ev.length && times[i] < tEnd; i++) eng._fire(ev[i].c, ev[i].n, ev[i].v, times[i], ev[i].d * spt); };
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
