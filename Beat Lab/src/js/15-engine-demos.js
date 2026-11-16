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
