// Beat Lab engine, part 7: Simple-mode songs. A simple song is a grid (notes stored as [column, scale row], drums as
// [column, lane]); E.fromSimple turns one into a normal one-pattern project, and E.fromSave turns anything Beat Lab
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
  E.SIMPLE_DEF = { key: 0, scale: 'major', oct: 4, range: 2, inst: 'piano', kit: 'electronic', bars: 4, beats: 4, split: 2, bpm: 110, echo: 1, swing: 0, mel: [], drm: [] };
  E.SIMPLE_INST = [
    { id: 'piano', n: 'Piano', p: 'grand-piano' }, { id: 'marimba', n: 'Marimba', p: 'marimba' }, { id: 'guitar', n: 'Guitar', p: 'nylon-guitar' },
    { id: 'strings', n: 'Strings', p: 'string-ensemble' }, { id: 'flute', n: 'Flute', p: 'flute' }, { id: 'synth', n: 'Synth', p: 'juno-keys' },
    { id: 'choir', n: 'Choir', p: 'choir-aahs' }, { id: 'bells', n: 'Bells', p: 'glockenspiel' }, { id: 'chip', n: '8-bit', p: 'chip-pulse-25' }, { id: 'bass', n: 'Bass', p: 'finger-bass' }
  ];
  E.SIMPLE_KITS = [
    { id: 'electronic', n: 'Electronic', p: ['808-kick', '808-snare', '808-closed-hat', '808-clap'] },
    { id: 'acoustic', n: 'Acoustic', p: ['acoustic-kick', 'acoustic-snare', 'acoustic-closed-hat', 'acoustic-side-stick'] },
    { id: 'lofi', n: 'Lo-fi', p: ['lo-fi-kick', 'lo-fi-snare', 'lo-fi-hat', 'lo-fi-rim'] },
    { id: 'trap', n: 'Trap', p: ['trap-808-kick', 'trap-snare', 'trap-hat', 'trap-clap'] },
    { id: 'house', n: 'House', p: ['house-kick', 'house-snare', 'house-closed-hat', 'house-clap'] },
    { id: 'latin', n: 'Bongos', p: ['perc-conga-low', 'perc-conga-high', 'perc-shaker', 'perc-cowbell'] },
    { id: 'chip', n: '8-bit', p: ['chip-kick', 'chip-snare', 'chip-hat', 'chip-tom'] }
  ];
  E.SIMPLE_LANES = ['Kick', 'Snare', 'Hi-hat', 'Clap'];
  E.simpleNormalize = function (s) {
    s = E.fill(s && typeof s === 'object' ? s : {}, E.SIMPLE_DEF);
    if (!E.SCALES[s.scale]) s.scale = 'major';
    s.bars = clamp(s.bars | 0, 1, 16); s.beats = clamp(s.beats | 0, 2, 7); s.split = clamp(s.split | 0, 1, 4); s.range = clamp(s.range | 0, 1, 3); s.oct = clamp(s.oct | 0, 2, 6);
    s.bpm = clamp(s.bpm | 0, 40, 220); s.key = clamp(s.key | 0, 0, 11);
    if (!E.SIMPLE_INST.some(x => x.id === s.inst)) s.inst = 'piano';
    if (!E.SIMPLE_KITS.some(x => x.id === s.kit)) s.kit = 'electronic';
    if (!Array.isArray(s.mel)) s.mel = []; if (!Array.isArray(s.drm)) s.drm = [];
    return s;
  };
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
    const inst = E.SIMPLE_INST.find(x => x.id === s.inst), kit = E.SIMPLE_KITS.find(x => x.id === s.kit);
    const melody = E.addChannel(p, inst.p, { n: inst.n, mix: 1 });
    const drums = kit.p.map((pid, i) => E.addChannel(p, pid, { n: E.SIMPLE_LANES[i], mix: 2, vol: i === 2 ? 0.7 : 0.8 }));
    p.mix[1].n = 'Melody'; p.mix[2].n = 'Drums';
    if (s.echo) {                                  // one shared reverb (a send bus) keeps it light on slow computers
      p.mix[3].n = 'Echo'; p.mix[3].fx.push({ t: 'reverb', on: 1, p: Object.assign(E.fxDefaults('reverb'), { size: 2.4, lc: 200, mix: 1 }) });
      p.mix[1].snd = [3, 0.42]; p.mix[2].snd = [3, 0.14];
    }
    p.mix[2].fx.push({ t: 'comp', on: 1, p: Object.assign(E.fxDefaults('comp'), { th: -16, ra: 3, mk: 2 }) });
    const pat = p.pat[0]; pat.len = steps; pat.n = 'Song';
    pat.nt[melody.id] = s.mel.filter(([c, r]) => c < cols && r < rows).map(([c, r]) => [at(c), len(c), E.simpleMidi(s, r), 100]).sort((a, b) => a[0] - b[0]);
    drums.forEach((ch, lane) => {
      const hits = s.drm.filter(([c, l]) => l === lane && c < cols);
      if (tpc % STEP === 0 && !sw8) { const st = pat.st[ch.id] = new Array(steps).fill(0); for (const [c] of hits) st[Math.round(c * tpc / STEP)] = (c * tpc) % PPQ === 0 ? 112 : 96; }
      else pat.nt[ch.id] = hits.map(([c]) => [at(c), len(c), 60, (c * tpc) % PPQ === 0 ? 112 : 96]).sort((a, b) => a[0] - b[0]);
    });
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
