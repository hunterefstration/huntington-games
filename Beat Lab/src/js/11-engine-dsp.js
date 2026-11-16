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
