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
