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
  syn(C, 'Choir Pad', { o1: o('vox', { uni: 3, det: 10 }), vowel: 'a', amp: A(0.5, 1, 0.9, 1.2), gain: 0.45, poly: 10 });
  syn(C, 'Dark Pad', { o1: o('sawtooth', { uni: 3, det: 14 }), sub: 0.5, f: F(600, 2), lfo: LFO('filter', 0.5, 0.15), amp: A(0.8, 1, 0.9, 1.5), gain: 0.5, poly: 10 });
  syn(C, 'Sweep Pad', { o1: o('sawtooth', { uni: 5, det: 16 }), f: F(900, 4), lfo: LFO('filter', 0.8, 0.1, { sync: '2/1', w: 'triangle' }), amp: A(0.5, 1, 0.9, 1.2), gain: 0.45, poly: 10 });
  syn(C, 'Supersaw Pad', { o1: o('sawtooth', { uni: 7, det: 25 }), f: F(5000, 0.7), amp: A(0.3, 1, 0.9, 1), gain: 0.35, poly: 10 });
  syn(C, 'Synthwave Pad', { o1: o('sawtooth', { uni: 5, det: 15 }), o2: o('pulse25', { lvl: 0.4 }), f: F(2000, 1, 1, 1, 2, 0.5, 1), amp: A(0.4, 1, 0.9, 1.2), gain: 0.4, poly: 10 });
  syn(C, 'Shimmer Pad', { o1: o('triangle', { uni: 5, det: 8 }), o2: o('sine', { oct: 2, lvl: 0.25 }), amp: A(1.2, 1, 0.9, 2), lfo: LFO('amp', 0.15, 0.4), gain: 0.55, poly: 10 });
  syn(C, 'Bell Pad', { o1: o('sine'), o2: o('sawtooth', { uni: 3, lvl: 0.3 }), fm: 2, fmr: 3.5, fmd: 1.5, f: F(2500), amp: A(0.01, 2, 0.6, 1.5), gain: 0.45, poly: 10 });
  syn(C, 'Lo-fi Tape Pad', { o1: o('warm', { uni: 3, det: 10 }), f: F(1800), lfo: LFO('pitch', 0.15, 0.5), drive: 0.1, amp: A(0.4, 1, 0.9, 1), gain: 0.5, poly: 10 });
  syn(C, 'Evolving Pad', { o1: o('string', { uni: 3, det: 12 }), o2: o('vox', { lvl: 0.5 }), f: F(1500, 3), lfo: LFO('filter', 0.5, 0.07), amp: A(1, 1, 0.9, 2), gain: 0.4, poly: 10 });
  syn(C, 'Air Pad', { o1: o('sine', { uni: 3, det: 10 }), nz: 0.12, f: F(1600, 1.2, 0, 0, 0, 0, 0, { t: 'bp' }), amp: A(1, 1, 0.9, 1.5), gain: 0.6, poly: 10 });

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
  syn(C, 'Nylon Guitar', { o1: o('pluck'), ks: ks(0.45, 0.45, 3.5, 0.2), f: F(4000), amp: A(0.001, 1, 1, 0.3), gain: 0.9, poly: 12 });
  syn(C, 'Steel Acoustic', { o1: o('pluck'), o2: o('pluck', { fine: 4, lvl: 0.4 }), ks: ks(0.2, 0.8, 4, 0.12), amp: A(0.001, 1, 1, 0.35), gain: 0.75, poly: 12 });
  syn(C, 'Clean Electric', { o1: o('pluck'), ks: ks(0.3, 0.6, 4, 0.15), f: F(3500), amp: A(0.001, 1, 1, 0.2), gain: 0.85 });
  syn(C, 'Muted Guitar', { o1: o('pluck'), ks: ks(0.9, 0.4, 0.5, 0.15), amp: A(0.001, 1, 1, 0.05), gain: 0.95 });
  syn(C, 'Overdrive Guitar', { o1: o('pluck'), ks: ks(0.15, 0.7, 5, 0.12), f: F(3500), amp: A(0.001, 1, 1, 0.15), drive: 0.55, gain: 0.55 });
  syn(C, 'Power Chord Guitar', { o1: o('pluck'), o2: o('pluck', { semi: 7, lvl: 0.6 }), ks: ks(0.15, 0.8, 5, 0.1), f: F(2800), amp: A(0.001, 1, 1, 0.12), drive: 0.9, gain: 0.45 });
  syn(C, 'Funk Guitar', { o1: o('pluck'), ks: ks(0.6, 0.8, 1, 0.1), f: F(1500, 2, 2, 0.001, 0.1, 0.2, 0.1, { t: 'bp' }), amp: A(0.001, 1, 1, 0.06), gain: 1 });
  syn(C, 'Banjo', { o1: o('pluck'), ks: ks(0.1, 1, 1.8, 0.05), amp: A(0.001, 1, 1, 0.2), gain: 0.8 });
  syn(C, '12-String Guitar', { o1: o('pluck'), o2: o('pluck', { oct: 1, fine: 3, lvl: 0.5 }), ks: ks(0.25, 0.75, 4, 0.12), amp: A(0.001, 1, 1, 0.3), gain: 0.7 });
  syn(C, 'Jazz Guitar', { o1: o('pluck'), ks: ks(0.7, 0.25, 3, 0.25), f: F(1800), amp: A(0.001, 1, 1, 0.2), gain: 1 });

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
  syn(C, 'Choir Aahs', { o1: o('vox', { uni: 5, det: 12 }), vowel: 'a', f: F(4000), amp: A(0.35, 0.5, 0.95, 0.8), lfo: LFO('pitch', 0.1, 5), gain: 0.45 });
  syn(C, 'Choir Oohs', { o1: o('hollow', { uni: 5, det: 12 }), vowel: 'u', amp: A(0.35, 0.5, 0.95, 0.8), lfo: LFO('pitch', 0.1, 5), gain: 0.55 });
  syn(C, 'Female Vox', { o1: o('sawtooth', { uni: 3, det: 8 }), vowel: 'e', amp: A(0.1, 0.3, 0.95, 0.4), lfo: LFO('pitch', 0.2, 5.5), gain: 0.4 });
  syn(C, 'Male Choir', { o1: o('sawtooth', { uni: 5, det: 12 }), vowel: 'o', f: F(3000), amp: A(0.5, 0.5, 0.95, 0.9), lfo: LFO('pitch', 0.08, 4.8), gain: 0.4 });
  syn(C, 'Vox Lead', { o1: o('sawtooth'), vowel: 'a', amp: A(0.03, 0.3, 0.95, 0.2), lfo: LFO('pitch', 0.25, 5.5), mono: 1, glide: 0.06, gain: 0.5 });
  syn(C, 'Talkbox', { o1: o('sawtooth'), o2: o('square', { lvl: 0.4 }), vowel: 'o', f: F(1800, 2, 0, 0, 0, 0, 0, { t: 'bp' }), lfo: LFO('filter', 0.6, 2), amp: A(0.01, 0.3, 0.95, 0.15), mono: 1, glide: 0.05, gain: 0.55 });
  syn(C, 'Whisper Pad', { o1: o('off'), nz: 1, vowel: 'a', amp: A(0.3, 0.5, 0.9, 0.8), gain: 0.7 });
  syn(C, 'Vocal Chop', { o1: o('vox'), vowel: 'a', amp: A(0.005, 0.25, 0, 0.1), gain: 0.6 });
  syn(C, 'Robot Voice', { o1: o('buzz'), vowel: 'i', amp: A(0.01, 0.2, 0.9, 0.1), gain: 0.4 });

  // ------------------------------------------------------------------ Chiptune
  C = 'Chiptune';
  syn(C, 'Chip Square', { o1: o('square'), amp: A(0.001, 0.1, 0.8, 0.04), vel: 0.3, gain: 0.72 });
  syn(C, 'Chip Pulse 25%', { o1: o('pulse25'), amp: A(0.001, 0.1, 0.8, 0.04), vel: 0.3, gain: 0.81 });
  syn(C, 'Chip Pulse 12%', { o1: o('pulse12'), amp: A(0.001, 0.1, 0.8, 0.04), vel: 0.3, gain: 0.9 });
  syn(C, 'Chip Triangle Bass', { o1: o('nestri'), amp: A(0.001, 0.1, 1, 0.03), vel: 0, gain: 1.44 });
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
  syn(C, 'Wind', { o1: o('off'), nz: 1, f: F(800, 3, 0, 0, 0, 0, 0, { t: 'bp' }), lfo: LFO('filter', 0.8, 0.2), amp: A(1, 1, 1, 1.5), gain: 0.8 });
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

  const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const seen = new Set();
  E.PRESETS = L.map(x => { let id = slug(x.n); while (seen.has(id)) id += '-2'; seen.add(id); return { id, n: x.n, c: x.c, p: x.p }; });
  E.CATEGORIES = [...new Set(E.PRESETS.map(x => x.c))];
  const byId = new Map(E.PRESETS.map(x => [x.id, x]));
  E.presetInfo = id => byId.get(id) || null;
  E.preset = function (id) { const x = byId.get(id); return x ? E.normParams(x.p) : null; };
  // a sensible step-sequencer note for drum channels is middle C (60); synth channels default to C4 too
})(BeatLabEngine);
