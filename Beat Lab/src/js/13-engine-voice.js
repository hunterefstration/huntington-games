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
