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
