// Beat Lab browser test: both modes open, demos play, editing, undo/redo, save/load, WAV render, simple -> studio,
// layers, 8 drum lanes and kits, articulations (rendered with and without), old simple songs, share codes, downloads,
// tutorials (every lesson driven step by step, Skip/Esc, first-time offers, players' songs untouched, the ? helper).
//   NODE_PATH=/opt/node22/lib/node_modules node "Beat Lab/tools/test.mjs" [--shots]
// Serves the repo itself on a free port (localhost: no licence gate). --shots saves two layout screenshots to /tmp.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname, SHOTS = process.argv.includes('--shots');
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(b); });
});
await new Promise(res => server.listen(0, '127.0.0.1', res));
const url = 'http://127.0.0.1:' + server.address().port + '/Beat%20Lab/index.html';
const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
let fails = 0;
const ok = (cond, name, extra) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!cond) fails++; };
const ev = (f, a) => page.evaluate(f, a);
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__beatlab && window.__beatlab.project, null, { timeout: 15000 });
  await page.mouse.click(600, 400);                                        // a user gesture: audio may start
  let st = await ev(() => window.__beatlab.state);
  ok(st.mode === 'simple', 'opens in simple mode for a new player', st.mode);
  await page.locator('#tut-offer').waitFor({ timeout: 3000 }).catch(() => {});
  ok(/Simple mode in 1 minute/.test(await page.locator('#tut-offer').innerText().catch(() => '')), 'tutorials: a first-time player is offered "Simple mode in 1 minute"');
  await page.locator('#tut-offer button', { hasText: 'No thanks' }).click();
  const pr = await ev(() => window.__beatlab.presets());
  ok(pr.total >= 150 && pr.categories >= 15, 'preset library is large and sorted into categories', pr);

  // ---- simple mode: paint, undo/redo, play
  await ev(() => window.__beatlab.newSimple());
  const box = await page.locator('#s-grid').boundingBox();
  await page.mouse.click(box.x + 20, box.y + 20);
  await page.mouse.click(box.x + 70, box.y + 60);
  await page.mouse.click(box.x + 20, box.y + box.height - 20);              // a drum lane
  let c = await ev(() => window.__beatlab.counts());
  ok(c.melody === 2 && c.drums === 1, 'simple: clicking the grid paints notes and drums', c);
  await ev(() => window.__beatlab.undo());
  c = await ev(() => window.__beatlab.counts());
  ok(c.drums === 0 && c.melody === 2, 'simple: undo removes the last hit', c);
  await ev(() => window.__beatlab.redo());
  c = await ev(() => window.__beatlab.counts());
  ok(c.drums === 1, 'simple: redo brings it back', c);
  await page.getByText('Surprise me!').click();
  c = await ev(() => window.__beatlab.counts());
  ok(c.melody > 4 && c.drums > 4, 'simple: Surprise me makes a tune and a beat', c);
  const n0 = (await ev(() => window.__beatlab.counts())).scheduled;
  await ev(() => window.__beatlab.play());
  const n1 = await ev(() => window.__beatlab.step(2));
  ok(n1 > n0, 'simple: playing schedules notes', { before: n0, after: n1 });
  await page.waitForTimeout(400);
  if (SHOTS) await page.screenshot({ path: '/tmp/beatlab-simple.png' });
  await ev(() => window.__beatlab.stop());
  const sstats = await ev(() => window.__beatlab.render({ mode: 'pat', pat: 1 }));
  ok(sstats.peak > 0.01, 'simple: renders a non-silent buffer', sstats);

  // ---- simple -> studio
  const before = await ev(() => window.__beatlab.counts());
  await ev(() => window.__beatlab.openInStudio());
  st = await ev(() => window.__beatlab.state);
  c = await ev(() => window.__beatlab.counts());
  ok(st.mode === 'studio' && c.channels === before.channels && c.notes + c.steps === before.melody + before.drums, 'Open in Studio makes a full project with every note', { st: st.mode, c, before });
  await page.locator('#tut-offer').waitFor({ timeout: 3000 }).catch(() => {});
  ok(/Take the 2-minute tour\?/.test(await page.locator('#tut-offer').innerText().catch(() => '')), 'tutorials: the first time in the Studio offers the 2-minute tour');
  await page.locator('#tut-offer button', { hasText: 'No thanks, I know studios' }).click();
  ok(await ev(() => !document.querySelector('#tut-offer') && window.__beatlab.app.set.seenStudio === 1), 'tutorials: "No thanks" closes the offer and is remembered');

  // ==== 2026-11-16: layers, 8 drum lanes and new kits, articulations ====
  // ---- layers: add from the UI, paint in the new one, mute, double, Open in Studio gives a channel per layer
  await ev(() => window.__beatlab.newSimple());
  await page.locator('.s-addl').click();
  let ly = await ev(() => ({ n: window.__beatlab.project.simple.ly.length, cur: window.__beatlab.project.simple.cur }));
  ok(ly.n === 2 && ly.cur === 1, 'layers: "+ Layer" adds a layer and selects it', ly);
  const gb = await page.locator('#s-grid').boundingBox();
  await page.mouse.click(gb.x + 30, gb.y + 30);
  ly = await ev(() => window.__beatlab.project.simple.ly.map(L => L.mel.length));
  ok(ly[0] === 0 && ly[1] === 1, 'layers: painting edits the selected layer only', ly);
  await page.locator('.s-layer').first().click();
  await page.mouse.click(gb.x + 80, gb.y + 50);
  await page.locator('.s-layer').nth(1).locator('.lm').click();
  ly = await ev(() => { const b = window.__beatlab, s = b.project.simple; return { mel: s.ly.map(L => L.mel.length), mute: s.ly.map(L => L.mute), ch: b.counts().channels }; });
  ok(ly.mel[0] === 1 && ly.mute[1] === 1 && ly.ch === 10, 'layers: second layer muted, 2 layers + 8 drum lanes = 10 channels', ly);
  const muted = await ev(() => { const b = window.__beatlab, sp = b.simpleProject(); const id = sp.smap.mel[1][0]; return { proj: sp.ch.find(c => c.id === id).mute, eng: b.engine.ch.get(id).muted }; });
  ok(muted.proj === 1 && muted.eng, 'layers: a muted layer is a muted channel in the engine', muted);
  await page.locator('.s-layer').first().locator('.lmore').click();
  await page.locator('#ctxmenu button', { hasText: 'Strings' }).click();
  ly = await ev(() => ({ dbl: window.__beatlab.project.simple.ly[0].dbl, ch: window.__beatlab.counts().channels, nt: (() => { const sp = window.__beatlab.simpleProject(), ids = sp.smap.mel[0]; return ids.map(id => JSON.stringify(sp.pat[0].nt[id])); })() }));
  ok(ly.dbl === 'strings' && ly.ch === 11 && ly.nt.length === 2 && ly.nt[0] === ly.nt[1], 'layers: "double with Strings" adds a second sound playing the same notes', ly);
  await ev(() => window.__beatlab.openInStudio());
  c = await ev(() => ({ st: window.__beatlab.state.mode, ch: window.__beatlab.project.ch.map(x => x.n + (x.mute ? '(m)' : '')) }));
  ok(c.st === 'studio' && c.ch.length === 11 && c.ch.filter(n => /\(m\)/.test(n)).length === 1, 'layers: Open in Studio gives each layer (and the double) its own channel', c.ch.slice(0, 4));
  await page.waitForTimeout(700);
  ok(await ev(() => !document.querySelector('#tut-offer')), 'tutorials: the Studio tour is offered only once');

  // ---- songs saved before layers (one instrument, 4 drum lanes) migrate and play exactly as before
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'Beat Lab/tools/simple-v1.json'), 'utf8'));
  const mig = await ev(fx => {
    const E = window.__beatlab.E, out = [];
    fx.saves.forEach((sv, i) => {
      const p = E.fromSave(JSON.stringify(sv)), want = fx.expect[i], byId = new Map(p.ch.map(ch => [ch.id, ch]));
      const ev = E.compile(p, 'song').ev.map(e => [e.t, e.d, byId.get(e.c).p, e.n, Math.round(e.v * 1000)]);
      const key = a => a.map(x => JSON.stringify(x)).sort().join('|');
      const chOk = want.ch.every(w => p.ch.some(c => c.p === w.p && JSON.stringify(c.s) === JSON.stringify(w.s) && c.vol === w.vol && c.mix === w.mix && c.root === w.root));
      out.push(key(ev) === key(want.ev) && chOk && JSON.stringify(p.mix) === JSON.stringify(want.mix) && p.bpm === want.bpm && p.swing === want.swing);
    });
    return out;
  }, fixture);
  ok(mig.every(Boolean), 'old simple songs: the converted projects play the same notes on the same sounds', mig);
  await ev(sv => window.__beatlab.load(sv), fixture.saves[1]);
  const om = await ev(() => { const s = window.__beatlab.project.simple; return { mode: window.__beatlab.state.mode, ly: s.ly.length, inst: s.ly[0].inst, n: s.ly[0].mel.length, lanes: [...new Set(s.drm.map(d => d[1]))].sort(), old: 'mel' in s || 'inst' in s }; });
  const want1 = fixture.saves[1].simple;
  ok(om.mode === 'simple' && om.ly === 1 && om.inst === want1.inst && om.n === want1.mel.length && !om.lanes.includes(3) && om.lanes.includes(4) && !om.old, 'old simple songs open as layer 1, clap moves to lane 4', om);

  // ---- 8 drum lanes in every new kit make sound (one hit per lane, half a second apart)
  const kitPeaks = await ev(async () => {
    const E = window.__beatlab.E, out = {};
    for (const kit of ['rock', 'world', 'orchestra', 'electronic', 'chip']) {
      const s = E.simpleNormalize({ kit, split: 1, bars: 2, beats: 4, bpm: 120, echo: 0 });
      s.drm = [0, 1, 2, 3, 4, 5, 6, 7].map(l => [l, l]);
      const buf = await E.render(E.fromSimple(s), { mode: 'pat', pat: 1, tail: 0.5 }), d = buf.getChannelData(0), sr = buf.sampleRate;
      out[kit] = [0, 1, 2, 3, 4, 5, 6, 7].map(l => { let pk = 0; for (let i = Math.floor((l * 0.5 + 0.02) * sr), e = i + Math.floor(0.25 * sr); i < e; i++) pk = Math.max(pk, Math.abs(d[i])); return +pk.toFixed(3); });
    }
    return out;
  });
  ok(Object.values(kitPeaks).every(a => a.length === 8 && a.every(v => v > 0.005)), 'drums: all 8 lanes of the new kits (and old ones) make sound', kitPeaks);
  ok((await ev(() => window.__beatlab.E.SIMPLE_KITS.map(k => k.p.every(id => !!window.__beatlab.E.presetInfo(id)) && k.p.length === 8))).every(Boolean), 'drums: every kit has 8 lanes of real presets');

  // ---- every articulation changes what is rendered (one note with and without it)
  const arts = await ev(async () => {
    const E = window.__beatlab.E, sr = 22050;
    const syn = E.normParams({ k: 'syn', o1: { w: 'sine', oct: 0, semi: 0, fine: 0, lvl: 1, uni: 1, det: 0 }, amp: { a: 0.004, d: 0.3, s: 0.8, r: 0.1 }, f: { t: 'lp', fc: 3000, q: 0.7, env: 0, kt: 0, vel: 0, a: 0.005, d: 0.4, s: 0.6, r: 0.4 }, vel: 0.6 });
    const proj = (notes, drum) => {
      const p = E.normalize({ bpm: 120, mix: E.newMixer(1) });
      if (drum) E.addChannel(p, '808-snare'); else p.ch.push({ id: 1, n: 'Sine', p: '', s: syn, mix: 0, vol: 0.8, pan: 0, mute: 0, solo: 0, root: 60 });
      p.pat[0].len = 16; p.pat[0].nt[p.ch[0].id] = notes; p.pl.cl = [[1, 0, 0, 16]];
      return p;
    };
    const rend = async p => (await E.render(p, { mode: 'pat', pat: 1, tail: 0.6, sampleRate: sr })).getChannelData(0);
    const at = s => Math.floor((s + 0.02) * sr);
    const peak = (d, a, b) => { let m = 0; for (let i = at(a); i < at(b); i++) m = Math.max(m, Math.abs(d[i])); return m; };
    const rms = (d, a, b) => { let m = 0, n = 0; for (let i = at(a); i < at(b); i++) { m += d[i] * d[i]; n++; } return Math.sqrt(m / Math.max(1, n)); };
    const zc = (d, a, b) => { let n = 0; for (let i = at(a) + 1; i < at(b); i++) if ((d[i - 1] < 0) !== (d[i] < 0)) n++; return n / (b - a) / 2; };       // ~ frequency in Hz
    const sounding = d => { const pk = peak(d, 0, 1.9), th = pk * 0.1; let last = 0; for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > th) last = i; return last / sr; };
    const one = a => [[0, 48, 69, 100].concat(a ? [a] : [])];                         // a quarter note of A4 (440 Hz)
    const base = await rend(proj(one()));
    const r = {};
    const acc = await rend(proj(one('acc'))); r.acc = [peak(base, 0, 0.4), peak(acc, 0, 0.4)];
    const soft = await rend(proj(one('soft'))); r.soft = [peak(base, 0, 0.4), peak(soft, 0, 0.4)];
    const stac = await rend(proj(one('stac'))); r.stac = [sounding(base), sounding(stac)];
    const vib = await rend(proj(one('vib'))); { const w = d => { const f = []; for (let t = 0.25; t < 0.5; t += 0.05) f.push(zc(d, t, t + 0.05)); return Math.max(...f) - Math.min(...f); }; r.vib = [w(base), w(vib)]; }
    const bend = await rend(proj(one('bend'))); r.bend = [zc(base, 0.01, 0.06), zc(bend, 0.01, 0.06)];
    const fall = await rend(proj(one('fall'))); r.fall = [zc(base, 0.4, 0.5), zc(fall, 0.4, 0.5)];
    const two = a => [[0, 24, 57, 100], [48, 48, 69, 100].concat(a ? [a] : [])];       // A3 then A4 (the second slides up from A3)
    const s0 = await rend(proj(two())), s1 = await rend(proj(two('slide'))); r.slide = [zc(s0, 0.505, 0.545), zc(s1, 0.505, 0.545)];
    const fl = (a, drum) => [[48, 12, 60, 100].concat(a ? [a] : [])];
    const f0 = await rend(proj(fl(), 1)), f1 = await rend(proj(fl('flam'), 1)); r.flam = [peak(f0, 0.46, 0.495), peak(f1, 0.46, 0.495)];
    const rl = a => [[0, 48, 60, 100].concat(a ? [a] : [])];
    const r0 = await rend(proj(rl(), 1)), r1 = await rend(proj(rl('roll'), 1)); r.roll = [rms(r0, 0.25, 0.5), rms(r1, 0.25, 0.5)];
    // the step sequencer's per-step articulation (pattern.sa)
    const sp = a => { const p = proj([], 1), id = p.ch[0].id; delete p.pat[0].nt[id]; p.pat[0].st[id] = [0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; if (a) p.pat[0].sa = { [id]: [0, 0, 0, 0, a] }; return p; };
    const q0 = await rend(sp()), q1 = await rend(sp('flam')); r.stepFlam = [peak(q0, 0.46, 0.495), peak(q1, 0.46, 0.495)];
    for (const k in r) r[k] = r[k].map(v => +v.toFixed(4));
    return r;
  });
  ok(arts.acc[1] > arts.acc[0] * 1.2, 'articulation accent: louder', arts.acc);
  ok(arts.soft[1] < arts.soft[0] * 0.7, 'articulation soft: quieter', arts.soft);
  ok(arts.stac[1] < arts.stac[0] * 0.7, 'articulation staccato: shorter', arts.stac);
  ok(arts.vib[1] > arts.vib[0] + 8, 'articulation vibrato: the pitch wobbles', arts.vib);
  ok(arts.bend[1] < arts.bend[0] - 15, 'articulation bend: starts lower than the note', arts.bend);
  ok(arts.fall[1] < arts.fall[0] - 15, 'articulation fall: drops away at the end', arts.fall);
  ok(arts.slide[1] < arts.slide[0] - 30, 'articulation slide: glides from the previous note', arts.slide);
  ok(arts.flam[1] > arts.flam[0] + 0.01, 'articulation flam: a grace hit just before', arts.flam);
  ok(arts.roll[1] > arts.roll[0] * 1.5, 'articulation roll: repeated hits', arts.roll);
  ok(arts.stepFlam[1] > arts.stepFlam[0] + 0.01, 'step sequencer: a flam step plays its grace hit', arts.stepFlam);

  // ---- articulations in the UI: Simple brush, piano roll Style + copy/paste, rack Style; survive undo and save/load
  await ev(() => window.__beatlab.newSimple());
  await page.mouse.click(gb.x + 30, gb.y + 30);
  await page.locator('.abtn', { hasText: 'Accent' }).click();
  await page.mouse.click(gb.x + 30, gb.y + 30);
  await page.mouse.click(gb.x + 30, gb.y + gb.height - 6);                       // a drum hit straight in with the brush
  let sa = await ev(() => { const s = window.__beatlab.project.simple; return { mel: s.ly[0].mel, drm: s.drm }; });
  ok(sa.mel.length === 1 && sa.mel[0][2] === 'acc' && sa.drm.length === 1 && sa.drm[0][2] === 'acc', 'simple: the Accent brush marks a note and adds an accented drum hit', sa);
  await ev(() => window.__beatlab.undo());
  sa = await ev(() => window.__beatlab.project.simple.drm.length);
  ok(sa === 0, 'simple: undo takes the brushed hit back', sa);
  await page.locator('.abtn', { hasText: 'Normal' }).click();
  const simpleId = await ev(() => { window.__beatlab.save(); return window.__beatlab.project.id; });
  sa = await ev(id => window.__beatlab.Store.load(id).simple.ly[0].mel[0], simpleId);
  ok(sa && sa[2] === 'acc', 'simple: the articulation is saved', sa);
  await ev(() => window.__beatlab.openInStudio());
  sa = await ev(() => { const p = window.__beatlab.project; return Object.values(p.pat[0].nt).flat().filter(n => n[4] === 'acc').length; });
  ok(sa === 1, 'simple: Open in Studio keeps the articulation on the note', sa);
  await ev(() => window.__beatlab.newStudio());
  await ev(() => { const A = window.__beatlab.app; A.ui.ch = A.p.ch[4].id; window.__beatlab.tab('roll'); });
  await page.waitForTimeout(150);
  const rb = await page.locator('.rl-cv').boundingBox();
  await page.mouse.click(rb.x + 120, rb.y + 120); await page.mouse.click(rb.x + 220, rb.y + 150);
  await page.keyboard.press('Control+a');
  await page.locator('#pane-roll .ptools select[title^="Articulation"]').selectOption('stac');
  let rn = await ev(() => { const A = window.__beatlab.app, q = A.p.pat[0]; return q.nt[A.ui.ch].map(n => n[4] || ''); });
  ok(rn.length === 2 && rn.every(a => a === 'stac'), 'piano roll: Style sets the articulation of the selected notes', rn);
  await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
  rn = await ev(() => { const A = window.__beatlab.app; return A.p.pat[0].nt[A.ui.ch].map(n => n[4] || ''); });
  ok(rn.length === 4 && rn.every(a => a === 'stac'), 'piano roll: copy and paste keep articulations', rn);
  await page.mouse.click(rb.x + 320, rb.y + 100);
  rn = await ev(() => { const A = window.__beatlab.app; return A.p.pat[0].nt[A.ui.ch].slice(-1)[0]; });
  ok(rn[4] === 'stac' && typeof rn[3] === 'number', 'piano roll: new notes take the chosen articulation (velocity still there)', rn);
  await page.keyboard.press('Escape');
  await page.locator('#pane-roll .ptools select[title^="Articulation"]').selectOption('');
  await ev(() => window.__beatlab.tab('rack'));
  await page.waitForTimeout(150);
  await page.locator('#pane-rack .ptools select').selectOption('flam');
  const kb2 = await page.locator('.rk-cv').boundingBox();
  await page.mouse.click(kb2.x + 8 + (kb2.width / 16) * 2, kb2.y + 17);
  let rs = await ev(() => { const A = window.__beatlab.app, q = A.p.pat[0], id = A.p.ch[0].id; return { st: q.st[id][2], sa: q.sa && q.sa[id] && q.sa[id][2] }; });
  ok(rs.st > 0 && rs.sa === 'flam', 'rack: Style flam turns a step on as a flam', rs);
  await page.locator('#pane-rack .ptools select').selectOption('');
  const stId = await ev(() => { window.__beatlab.save(); return window.__beatlab.project.id; });
  rs = await ev(id => { const p = window.__beatlab.Store.load(id), ch = p.ch[4].id; return { sa: p.pat[0].sa && p.pat[0].sa[p.ch[0].id][2], nt: p.pat[0].nt[ch].filter(n => n[4] === 'stac').length }; }, stId);
  ok(rs.sa === 'flam' && rs.nt === 5, 'studio: step and note articulations survive save and load', rs);
  const wavArt = await ev(() => window.__beatlab.render({ mode: 'pat', pat: 1 }));
  ok(wavArt.peak > 0.01, 'studio: a pattern with articulations renders (WAV export path)', wavArt);
  // ---- Studio: drum section in the browser, a whole kit at once
  const ch0k = (await ev(() => window.__beatlab.counts())).channels;
  ok(await page.locator('.bsec', { hasText: 'Drums & Percussion' }).count() === 1, 'browser: has a Drums & Percussion section');
  await page.locator('.bkit').click();
  await page.locator('#ctxmenu button', { hasText: 'Orchestra' }).first().click();
  const ch1k = (await ev(() => window.__beatlab.counts())).channels;
  ok(ch1k === ch0k + 8, '"+ New drum kit" adds a whole kit as channels', { ch0k, ch1k });

  // ---- demos play in song mode
  for (const id of ['lofi', 'trap', 'synthwave', 'house', 'orchestral', 'chip']) {
    await ev(id => window.__beatlab.loadDemo(id), id);
    const a = (await ev(() => window.__beatlab.counts())).scheduled;
    await ev(() => window.__beatlab.play('song'));
    const b = await ev(() => window.__beatlab.step(3));
    await ev(() => window.__beatlab.stop());
    ok(b - a > 5, 'demo "' + id + '" plays (scheduler emits notes)', { notes: b - a });
  }
  // ---- every view draws without errors
  await ev(() => window.__beatlab.loadDemo('synthwave'));
  for (const t of ['playlist', 'rack', 'roll', 'synth', 'mixer']) { await ev(t => window.__beatlab.tab(t), t); await page.waitForTimeout(150); }
  ok(errs.length === 0, 'every studio view draws without a script error', errs.slice(0, 3));

  // ---- editing: steps in the rack, notes in the piano roll
  await ev(() => window.__beatlab.newStudio());
  await ev(() => window.__beatlab.tab('rack'));
  await page.waitForTimeout(200);
  const rk = await page.locator('.rk-cv').boundingBox();
  const s0 = (await ev(() => window.__beatlab.counts())).steps;
  await page.mouse.click(rk.x + 8, rk.y + 17);
  await page.mouse.click(rk.x + 8 + (rk.width / 16) * 4, rk.y + 17);
  let s1 = (await ev(() => window.__beatlab.counts())).steps;
  ok(s1 === s0 + 2, 'rack: clicking steps turns them on', { s0, s1 });
  await page.keyboard.press('Control+z');
  s1 = (await ev(() => window.__beatlab.counts())).steps;
  ok(s1 === s0 + 1, 'rack: Ctrl+Z undoes a step', { s1 });
  await page.keyboard.press('Control+y');
  s1 = (await ev(() => window.__beatlab.counts())).steps;
  ok(s1 === s0 + 2, 'rack: Ctrl+Y redoes it', { s1 });
  await ev(() => { const A = window.__beatlab.app; A.ui.ch = A.p.ch[4].id; window.__beatlab.tab('roll'); });
  await page.waitForTimeout(200);
  const rl = await page.locator('.rl-cv').boundingBox();
  const k0 = (await ev(() => window.__beatlab.counts())).notes;
  await page.mouse.click(rl.x + 120, rl.y + 120);
  await page.mouse.click(rl.x + 220, rl.y + 150);
  let k1 = (await ev(() => window.__beatlab.counts())).notes;
  ok(k1 === k0 + 2, 'piano roll: clicking draws notes', { k0, k1 });
  await page.mouse.click(rl.x + 120 + 4, rl.y + 120, { button: 'right' });
  k1 = (await ev(() => window.__beatlab.counts())).notes;
  ok(k1 === k0 + 1, 'piano roll: right-click deletes a note', { k1 });
  await page.keyboard.press('Control+a'); await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
  k1 = (await ev(() => window.__beatlab.counts())).notes;
  ok(k1 === k0 + 2, 'piano roll: select all, copy, paste', { k1 });
  await ev(() => { window.__beatlab.app.ui.playMode = 'pat'; });
  const pa = (await ev(() => window.__beatlab.counts())).scheduled;
  await ev(() => window.__beatlab.play('pat'));
  const pb = await ev(() => window.__beatlab.step(2.5));
  await ev(() => window.__beatlab.stop());
  ok(pb > pa, 'pattern mode plays the edited pattern', { notes: pb - pa });
  if (SHOTS) { await ev(() => window.__beatlab.loadDemo('house')); await ev(() => window.__beatlab.tab('roll')); await ev(() => { const A = window.__beatlab.app; A.ui.pat = 3; A.ui.ch = 7; window.__beatlab.tab('roll'); }); await page.waitForTimeout(400); await page.screenshot({ path: '/tmp/beatlab-studio.png' }); await ev(() => window.__beatlab.newStudio()); }

  // ---- playlist: place a clip, set a loop region in the ruler, play the song
  await ev(() => window.__beatlab.newStudio());
  await ev(() => window.__beatlab.tab('playlist'));
  await page.waitForTimeout(200);
  const pl = await page.locator('.pl-cv').boundingBox();
  const c0 = (await ev(() => window.__beatlab.counts())).clips;
  await page.mouse.click(pl.x + 300, pl.y + 40 * 2 + 20);
  const c1 = (await ev(() => window.__beatlab.counts())).clips;
  ok(c1 === c0 + 1, 'playlist: clicking places a pattern clip', { c0, c1 });
  const ru = await page.locator('.pl-rul').boundingBox();
  await page.mouse.move(ru.x + 10, ru.y + 12); await page.mouse.down(); await page.mouse.move(ru.x + 150, ru.y + 12, { steps: 5 }); await page.mouse.up();
  const loop = await ev(() => window.__beatlab.project.loop);
  ok(Array.isArray(loop) && loop[1] > loop[0], 'playlist: dragging in the ruler sets a loop region', loop);
  // ---- mixer: add an effect from the UI, the engine builds it
  await ev(() => window.__beatlab.tab('mixer'));
  await page.waitForTimeout(200);
  await page.locator('.mx-strip').nth(1).locator('.slot.add').click();
  await page.locator('#ctxmenu button', { hasText: 'Reverb' }).click();
  await page.waitForTimeout(100);
  const fx = await ev(() => ({ p: window.__beatlab.project.mix[1].fx.map(f => f.t), e: !!(window.__beatlab.engine.mix[1] && window.__beatlab.engine.mix[1].fx[0]) }));
  ok(fx.p[0] === 'reverb' && fx.e, 'mixer: "+ effect" adds a reverb and the engine builds it', fx);
  const kn = page.locator('.mx-editor .knob').first().locator('.dial'), kb = await kn.boundingBox();
  const v0 = await ev(() => window.__beatlab.project.mix[1].fx[0].p.size);
  await page.mouse.move(kb.x + 10, kb.y + 10); await page.mouse.down(); await page.mouse.move(kb.x + 10, kb.y - 30, { steps: 4 }); await page.mouse.up();
  const v1 = await ev(() => window.__beatlab.project.mix[1].fx[0].p.size);
  ok(v1 > v0, 'mixer: dragging an effect knob changes it', { v0, v1 });
  // ---- instrument editor: a knob edits the sound, undo puts it back, save as user preset
  await ev(() => { const A = window.__beatlab.app; A.ui.ch = A.p.ch[4].id; window.__beatlab.tab('synth'); });
  await page.waitForTimeout(200);
  const cut = page.locator('.sy-card', { hasText: 'Filter' }).locator('.knob', { hasText: 'Cutoff' }).first().locator('.dial'), cb = await cut.boundingBox();
  const f0 = await ev(() => window.__beatlab.app.p.ch[4].s.f.fc);
  await page.mouse.move(cb.x + 10, cb.y + 10); await page.mouse.down(); await page.mouse.move(cb.x + 10, cb.y + 60, { steps: 4 }); await page.mouse.up();
  const f1 = await ev(() => window.__beatlab.app.p.ch[4].s.f.fc);
  await ev(() => window.__beatlab.undo());
  const f2 = await ev(() => window.__beatlab.app.p.ch[4].s.f.fc);
  ok(f1 < f0 && f2 === f0, 'instrument: cutoff knob edits the synth, undo restores it', { f0, f1, f2 });
  await page.locator('.ptools button', { hasText: 'Save as preset' }).click();
  await page.locator('.mbox input').fill('My Keys');
  await page.keyboard.press('Enter');
  const up = await ev(() => window.__beatlab.Store.userPresets().map(p => p.n));
  ok(up.includes('My Keys'), 'instrument: Save as preset adds a user preset', up);
  // ---- browser: + adds a channel with that sound
  const ch0 = (await ev(() => window.__beatlab.counts())).channels;
  const item = page.locator('.bitem', { hasText: 'Grand Piano' }).first();
  await item.hover(); await item.locator('.badd').click();
  const ch1 = (await ev(() => window.__beatlab.counts())).channels;
  ok(ch1 === ch0 + 1, 'browser: + adds a channel', { ch0, ch1 });
  // ---- recording from the computer keyboard (no count-in)
  await ev(() => { const A = window.__beatlab.app; A.set.countIn = 0; A.ui.ch = A.p.ch[A.p.ch.length - 1].id; window.__beatlab.tab('roll'); });
  const r0 = (await ev(() => window.__beatlab.counts())).notes;
  await page.locator('.tbtn.rec').click();
  await page.waitForTimeout(300);
  for (const k of ['KeyZ', 'KeyX', 'KeyC']) { await page.keyboard.down(k); await page.waitForTimeout(140); await page.keyboard.up(k); await page.waitForTimeout(60); }
  await page.keyboard.press('Space');
  const r1 = await ev(() => ({ notes: window.__beatlab.counts().notes, rec: window.__beatlab.state.rec, undo: window.__beatlab.state.undo }));
  ok(r1.notes === r0 + 3 && !r1.rec, 'recording: three keys become three notes', { r0, r1 });
  // ---- export the project file and import it back
  const dj = page.waitForEvent('download');
  await page.locator('#appbar button', { hasText: 'Download' }).click();
  await page.locator('.dl-opt', { hasText: 'Project file' }).click();
  const jf = await (await dj).path();
  const exported = JSON.parse(fs.readFileSync(jf, 'utf8'));
  await page.locator('#appbar button', { hasText: 'Projects' }).click();
  await page.locator('.mbox input[type=file]').setInputFiles(jf);
  await page.waitForTimeout(300);
  const imp = await ev(() => ({ id: window.__beatlab.project.id, name: window.__beatlab.project.name, n: window.__beatlab.counts().notes }));
  ok(exported.name === imp.name && imp.id !== exported.id && imp.n === r1.notes, 'export then import gives the same song as a new project', { name: imp.name, n: imp.n });

  // ---- save / load round trip
  await ev(() => window.__beatlab.loadDemo('trap'));
  const id = await ev(() => { window.__beatlab.project.name = 'Round trip'; window.__beatlab.save(); return window.__beatlab.project.id; });
  const snap = await ev(() => JSON.stringify(window.__beatlab.project));
  await page.reload();
  await page.waitForFunction(() => window.__beatlab && window.__beatlab.project);
  const back = await ev(() => ({ id: window.__beatlab.project.id, json: JSON.stringify(window.__beatlab.project), keys: Object.keys(localStorage).filter(k => k.startsWith('beatlab_')).length }));
  ok(back.id === id && JSON.parse(back.json).name === 'Round trip', 'reload opens the last project', { id: back.id === id, keys: back.keys });
  const a1 = JSON.parse(snap), b1 = JSON.parse(back.json); delete a1.t; delete b1.t;
  ok(JSON.stringify(a1) === JSON.stringify(b1), 'save/load round trip keeps the project exactly');
  const sizes = await ev(() => Object.keys(localStorage).filter(k => k.startsWith('beatlab_p_')).map(k => localStorage.getItem(k).length));
  ok(sizes.every(n => n < 400 * 1024), 'every project fits in one 400 KB key', { max: Math.max(...sizes) });

  // ---- WAV export of a demo song
  const t0 = Date.now();
  const ws = await ev(() => window.__beatlab.render({ mode: 'song', from: 0, to: 8 * 192 }));
  ok(ws.peak > 0.05 && ws.rms > 0.005 && ws.peak <= 1.0, 'WAV render of 8 bars is loud enough and does not clip', Object.assign(ws, { ms: Date.now() - t0 }));
  const dl = page.waitForEvent('download', { timeout: 60000 });
  await ev(() => { window.__beatlab.app.p.pl.cl = window.__beatlab.app.p.pl.cl.filter(c => c[2] < 64); });
  await page.locator('.st-bar button', { hasText: 'Export WAV' }).click();
  await page.locator('.mbox button', { hasText: 'Export' }).click();
  await page.locator('.mbox button', { hasText: 'Download' }).click({ timeout: 60000 });
  const d = await dl;
  const f = await d.path(), size = fs.statSync(f).size, head = fs.readFileSync(f).subarray(0, 4).toString();
  ok(head === 'RIFF' && size > 100000, 'Export WAV button downloads a WAV file', { size });

  // ---- sharing with a code (stubbed launcher API), opening a code, downloads
  await ev(() => { delete window.HGGrapevine; window.__beatlab.newSimple(); });
  await page.locator('#appbar button', { hasText: 'Share' }).click();
  const signIn = await page.locator('.mbox').innerText();
  ok(/Sign in to the launcher to share/.test(signIn), 'share: without the launcher it asks to sign in', signIn.slice(0, 60));
  await page.locator('.mbox button', { hasText: 'OK' }).click();
  await page.getByText('Surprise me!').click();
  await ev(() => { const s = window.__beatlab.project.simple; s.ly[0].mel[0][2] = 'vib'; s.drm.push([3, 6, 'roll']); window.__beatlab.save(); });
  await ev(() => { window.__shared = null; window.HGGrapevine = { songs: {
    share: async o => { if (window.__refuse) return { ok: false, err: 'You shared 10 songs today: try again tomorrow.' }; window.__shared = o; return { ok: true, code: '123456' }; },
    get: async code => code === '123456' && window.__shared ? { ok: true, name: window.__shared.name, by: 'Tester', at: Date.now(), data: window.__shared.data } : { ok: false, err: 'No song has that code' } } }; });
  await page.locator('#appbar button', { hasText: 'Share' }).click();
  await page.locator('#sh-post').check();
  await page.locator('.mbox button', { hasText: 'Get a code' }).click();
  await page.locator('#sh-code').waitFor({ timeout: 5000 });
  const code = await page.locator('#sh-code').innerText();
  const shared = await ev(() => ({ name: window.__shared.name, post: window.__shared.post, same: window.__shared.data === localStorage.getItem('beatlab_p_' + window.__beatlab.project.id), kb: window.__shared.data.length >> 10 }));
  ok(code === '123456' && shared.post === true && shared.same, 'share: shows the code big and sends the saved song (post in #music ticked)', { code, shared });
  await page.locator('.mbox button', { hasText: 'Close' }).click();
  const orig = await ev(() => ({ id: window.__beatlab.project.id, name: window.__beatlab.project.name, simple: JSON.stringify(window.__beatlab.project.simple) }));
  await page.locator('#appbar button', { hasText: 'Projects' }).click();
  await page.locator('.mbox .codefield input').fill('123456');
  await page.locator('.mbox .codefield button', { hasText: 'Open' }).click();
  await page.locator('.mbox h3', { hasText: 'Opened' }).waitFor({ timeout: 5000 });
  const got = await ev(() => ({ id: window.__beatlab.project.id, name: window.__beatlab.project.name, mode: window.__beatlab.project.mode, simple: JSON.stringify(window.__beatlab.project.simple), saved: !!localStorage.getItem('beatlab_p_' + window.__beatlab.project.id) }));
  ok(got.id !== orig.id && got.name === orig.name + ' (by Tester)' && got.mode === 'simple' && got.simple === orig.simple && got.saved, 'open a code: the shared song opens as a new, identical project', { name: got.name, same: got.simple === orig.simple });
  ok(await ev(id => !!localStorage.getItem('beatlab_p_' + id), orig.id), 'open a code: the sharer\'s own copy is untouched');
  await page.locator('.mbox button', { hasText: 'Download' }).click();
  await page.locator('.dl-opt', { hasText: 'Just the drums' }).waitFor({ timeout: 3000 });
  const dlDrums = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('.dl-opt', { hasText: 'Just the drums' }).click();
  await page.locator('.mbox button', { hasText: 'Download' }).click({ timeout: 60000 });
  const dd = await dlDrums;
  ok(/_drums\.wav$/.test(dd.suggestedFilename()) && fs.statSync(await dd.path()).size > 50000, 'download: "Just the drums" saves a WAV of the drums', dd.suggestedFilename());
  const stems = await ev(async () => { const b = window.__beatlab, E = b.E, sp = E.fromSimple(b.project.simple), out = {}; for (const st of ['drums', 'melody']) { const p = b.stemProject(sp, st); out[st] = p.ch.filter(c => !c.mute).map(c => c.s.k); } return out; });
  ok(stems.drums.every(k => k === 'drm') && stems.melody.every(k => k !== 'drm') && stems.melody.length > 0, 'download: the drums and melody stems keep the right channels', stems);
  await ev(() => { window.__refuse = true; });
  await page.locator('#appbar button', { hasText: 'Share' }).click();
  await page.locator('.mbox button', { hasText: 'Get a code' }).click();
  await page.locator('.sh-err').waitFor({ timeout: 5000 });
  ok(/10 songs today/.test(await page.locator('.sh-err').innerText()), 'share: a refusal (daily limit) is shown');
  await page.locator('.mbox button', { hasText: 'Close' }).click();
  await ev(() => { delete window.HGGrapevine; });

  { // ==== 1.2 (2026-11-16): tutorials. Each lesson is driven by doing what each step asks, through the real UI ====
  const T = () => ev(() => window.__beatlab.tut.state);
  const xy = (k, a, b) => ev(([k, a, b]) => window.__beatlab.tut.xy(k, a, b), [k, a, b]);
  const clickAt = async (k, a, b) => { const p = await xy(k, a, b); await page.mouse.click(p.x, p.y); };
  const dragFrom = async (p, dx, dy) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + dx / 2, p.y + dy / 2, { steps: 3 }); await page.mouse.move(p.x + dx, p.y + dy, { steps: 3 }); await page.mouse.up(); };
  const dragEl = async (loc, dx, dy) => { const b = await loc.boundingBox(); await dragFrom({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, dx, dy); };
  const bub = t => page.locator('#tut .tut-bubble button', { hasText: t });
  const next = () => page.locator('#tut .tut-bubble .tut-btns button.primary').click();
  const fin = () => page.waitForFunction(() => window.__beatlab.tut.state.finale, null, { timeout: 5000 }).catch(() => {});
  const reach = async (n, name) => {                       // the lesson moves on by itself once the step is done
    await page.waitForFunction(n => { const s = window.__beatlab.tut.state; return s.active && s.step >= n; }, n, { timeout: 5000 }).catch(() => {});
    const s = await T(); ok(s.step === n, name, { step: s.step, title: s.title, prog: s.prog });
  };
  const savedSongs = () => ev(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('beatlab_p_')) o[k] = localStorage.getItem(k); } return o; });
  // the player's own song: a Studio project with an edit in its undo history
  await ev(() => { const b = window.__beatlab; b.newStudio(); b.Hist.edit('Name', () => { b.project.name = 'My own beat'; }); b.save(); });
  const mine = await ev(() => ({ id: window.__beatlab.project.id, undo: window.__beatlab.state.undo }));
  const before0 = await savedSongs();
  const isMine = async name => { const s = await ev(() => ({ id: window.__beatlab.project.id, mode: window.__beatlab.state.mode, undo: window.__beatlab.state.undo, last: window.__beatlab.app.set.last, active: window.__beatlab.tut.state.active })); ok(!s.active && s.id === mine.id && s.mode === 'studio' && s.undo === mine.undo && s.last === mine.id, name, s); };

  // ---- the Learn hub (app bar, both modes) lists six lessons
  await page.locator('#appbar .learn').click();
  ok(await page.locator('.learn .lrow').count() === 6 && await page.locator('.learn .lrow.done').count() === 0, 'learn hub: six lessons, none ticked yet');
  await page.locator('.mbox button', { hasText: 'Close' }).click();

  // ---- lesson 1: Simple mode in 1 minute (started from the hub)
  await page.locator('#appbar .learn').click();
  await page.locator('.lrow[data-l="simple1"] button').click();
  let ts = await T();
  ok(ts.active && ts.id === 'simple1' && ts.temp && ts.prog === '1 of 9' && await ev(() => window.__beatlab.state.mode) === 'simple', 'simple lesson: starts in its own practice song ("1 of 9")', ts);
  await next(); await reach(1, 'simple lesson: Next moves on from an explanation');
  for (let i = 0; i < 6; i++) await clickAt('simple', i * 2, [0, 2, 4, 3, 1, 5][i]);
  await reach(2, 'simple lesson: painting 6 notes advances');
  for (const col of [0, 4, 8, 12]) await clickAt('drum', col, 0);
  await reach(3, 'simple lesson: 4 drum hits advance');
  await page.locator('.s-insts .ibtn:not(.on)').first().click();
  await reach(4, 'simple lesson: changing the instrument advances');
  await page.locator('.s-addl').click();
  await reach(5, 'simple lesson: + Layer advances');
  for (const col of [1, 3, 5]) await clickAt('simple', col, 6);
  await reach(6, 'simple lesson: painting the new layer advances');
  await page.locator('.abtn', { hasText: 'Accent' }).click();
  await clickAt('simple', 3, 6);
  await reach(7, 'simple lesson: the articulation brush advances');
  await page.locator('#s-play').click();
  await reach(8, 'simple lesson: Play advances');
  await page.locator('#simple .s-bottom .btn.primary').click();
  await fin();
  ts = await T();
  ok(ts.finale && ts.done.simple1 === 1 && ts.temp && await ev(() => window.__beatlab.state.mode) === 'studio', 'simple lesson: Open in Studio finishes it, still a practice song, remembered as done', ts);
  ok(await ev(() => JSON.parse(localStorage.getItem('beatlab_set')).tut.simple1 === 1), 'tutorials: finished lessons are in the synced settings key');
  await page.locator('#tut .tut-skip').click();                                   // "Back to my song"
  await isMine('simple lesson: "Back to my song" reopens the player\'s song with its undo history');

  // ---- lesson 2: Studio 1, then straight on to Studio 2 from the finale
  await ev(() => window.__beatlab.tut.start('studio1'));
  await next(); await reach(1, 'studio 1: the channel rack explained');
  for (const s of [0, 4, 8, 12]) await clickAt('rack', 0, s);
  await reach(2, 'studio 1: 4 kick steps advance');
  for (const s of [4, 12]) await clickAt('rack', 3, s);
  await reach(3, 'studio 1: 2 snare steps advance');
  for (const s of [0, 2, 4, 6, 8, 10]) await clickAt('rack', 2, s);
  await reach(4, 'studio 1: 6 hat steps advance');
  await page.keyboard.press('Space');
  await reach(5, 'studio 1: Space plays and advances');
  await dragEl(page.locator('.st-bar .dragnum'), 0, -30);
  await reach(6, 'studio 1: dragging the tempo advances');
  await page.locator('.st-bar .tbtn.stop').click();
  await reach(7, 'studio 1: Stop advances');
  await page.locator('.st-bar button[title="New pattern"]').click();
  await reach(8, 'studio 1: + pattern advances');
  await page.locator('.st-bar select.pat').selectOption('1');
  await fin();
  ts = await T();
  const beat = await ev(() => window.__beatlab.counts());
  ok(ts.finale && ts.done.studio1 === 1 && beat.steps >= 12, 'studio 1: picking Pattern 1 finishes it with a real beat', { ts, steps: beat.steps });
  await bub('Next: Studio 2').click();
  ts = await T();
  ok(ts.active && ts.id === 'studio2' && ts.step === 0 && ts.temp, 'studio 1 -> 2: "Next" starts the next lesson in a fresh practice song', ts);
  await next(); await reach(1, 'studio 2: the browser explained');
  await page.locator('#browser .bitem').first().hover();
  await page.locator('#browser .bitem .badd').first().click();
  await reach(2, 'studio 2: + on a sound adds a channel and advances');
  await page.locator('.tabs button[data-t="roll"]').click();
  await reach(3, 'studio 2: opening the piano roll advances');
  for (const [t, m] of [[0, 60], [48, 63], [96, 67], [144, 70]]) await clickAt('roll', t, m);
  await reach(4, 'studio 2: drawing 4 notes advances');
  await dragFrom(await xy('roll', 10, 60), 50, 0);
  await reach(5, 'studio 2: dragging a note\'s end longer advances');
  await clickAt('vel', 0, 40);
  await reach(6, 'studio 2: lowering a velocity bar advances');
  await page.locator('#pane-roll .ptools select').filter({ has: page.locator('option[value="dorian"]') }).selectOption('major');
  await reach(7, 'studio 2: changing the scale advances');
  await page.locator('#pane-roll button[data-t="chord"]').click();
  await clickAt('roll', 168, 55);
  await reach(8, 'studio 2: stamping a chord advances');
  await page.locator('#pane-roll select[title^="Articulation"]').selectOption('stac');
  await reach(9, 'studio 2: giving notes a style advances');
  await page.locator('.st-bar .tbtn.play').click();
  await fin();
  const mel = await ev(() => { const p = window.__beatlab.project, c = p.ch[p.ch.length - 1], n = p.pat[0].nt[c.id] || []; return { n: n.length, art: n.filter(x => x[4]).length, scale: p.scale }; });
  ok((await T()).finale && mel.n >= 7 && mel.art >= 3 && mel.scale === 'major', 'studio 2: playing finishes it; the melody has notes, a chord and styles', mel);
  await page.keyboard.press('Escape');                                            // Esc on the finale: back to my song
  await isMine('studio 2: Esc on the last card goes back to the player\'s song');

  // ---- lesson 4: Studio 3, arrange a song
  await ev(() => window.__beatlab.tut.start('studio3'));
  await next(); await reach(1, 'studio 3: patterns explained');
  await page.locator('.tabs button[data-t="playlist"]').click();
  await reach(2, 'studio 3: opening the playlist advances');
  const place = page.locator('#pane-playlist select[title="Pattern you place with a click"]');
  await place.selectOption('1');
  await clickAt('pl', 0, 0);
  await reach(3, 'studio 3: placing the Beat clip advances');
  await place.selectOption('2');
  await clickAt('pl', 16, 0);
  await reach(4, 'studio 3: placing the second part advances');
  const a1 = await xy('pl', 3, 0), a2 = await xy('pl', 3, 1);
  await dragFrom(a1, 0, a2.y - a1.y);
  await reach(5, 'studio 3: dragging a clip advances');
  await page.keyboard.down('Shift'); const c1 = await xy('pl', 19, 0), c2 = await xy('pl', 35, 0); await dragFrom(c1, c2.x - c1.x, 0); await page.keyboard.up('Shift');
  await reach(6, 'studio 3: shift-dragging a copy advances');
  await page.locator('.st-bar .seg button[data-m="song"]').click();
  await reach(7, 'studio 3: Song mode advances');
  await page.locator('.st-bar .tbtn.play').click();
  await reach(8, 'studio 3: Play advances');
  const r1 = await xy('ruler', 0), r2 = await xy('ruler', 32);
  await dragFrom(r1, r2.x - r1.x, 0);
  await fin();
  const arr = await ev(() => ({ cl: window.__beatlab.project.pl.cl.length, loop: window.__beatlab.project.loop }));
  ok((await T()).finale && arr.cl >= 3 && arr.loop && arr.loop[1] > arr.loop[0], 'studio 3: a loop region finishes it; the song is arranged', arr);
  await bub('All lessons').click();
  await page.locator('.learn .lrow').first().waitFor({ timeout: 3000 }).catch(() => {});
  ok(await page.locator('.learn .lrow.done').count() === 4 && (await ev(() => window.__beatlab.project.id)) === mine.id, 'learn hub: "All lessons" goes back to my song and shows 4 ticks');
  await page.locator('.lrow[data-l="studio4"] button').click();

  // ---- lesson 5: Studio 4, mix it (started from the hub)
  ok((await T()).id === 'studio4', 'studio 4: starts from the hub');
  await page.locator('.tabs button[data-t="mixer"]').click();
  await reach(1, 'studio 4: opening the mixer advances');
  await next(); await reach(2, 'studio 4: mixer tracks explained');
  await next(); await reach(3, 'studio 4: routing explained');
  await page.keyboard.press('Space');
  await reach(4, 'studio 4: Space plays and advances');
  const keys = page.locator('.mx-strip').nth(5);
  await dragEl(keys.locator('.fader'), 0, 25);
  await reach(5, 'studio 4: moving the Keys fader advances');
  await dragEl(keys.locator('.mx-row').last().locator('.dial'), 0, -30);
  await reach(6, 'studio 4: turning the pan knob advances');
  await page.locator('.mx-strip').nth(5).locator('.slot.add').click();
  await page.locator('#ctxmenu button', { hasText: 'Reverb' }).click();
  await reach(7, 'studio 4: adding a reverb advances');
  await dragEl(page.locator('.mx-editor .knob .dial').first(), 0, -30);
  await reach(8, 'studio 4: turning an effect knob advances');
  await next();
  const mx = await ev(() => { const m = window.__beatlab.project.mix[5]; return { vol: m.vol, pan: m.pan, fx: m.fx.map(f => f.t) }; });
  ok((await T()).finale && mx.vol !== 0.8 && mx.pan !== 0 && mx.fx.includes('reverb'), 'studio 4: the limiter card finishes it; the keys are mixed', mx);
  await page.locator('#tut .tut-skip').click();
  await isMine('studio 4: back to the player\'s song');

  // ---- lesson 6: Studio 5, finish and share (keeps the practice song when the player presses Save)
  await ev(() => window.__beatlab.tut.start('studio5'));
  await page.locator('#appbar .pname').click();
  await page.locator('.mbox input').fill('Tutorial tune');
  await page.locator('.mbox input').press('Enter');
  await reach(1, 'studio 5: renaming the song advances');
  await page.locator('#appbar button', { hasText: 'Save' }).click();
  await reach(2, 'studio 5: Save keeps the practice song and advances');
  const kept = await ev(() => ({ id: window.__beatlab.project.id, name: window.__beatlab.project.name, saved: !!localStorage.getItem('beatlab_p_' + window.__beatlab.project.id), temp: window.__beatlab.tut.state.temp }));
  ok(kept.saved && !kept.temp && kept.name === 'Tutorial tune', 'studio 5: the kept song is saved as one of the player\'s songs', kept);
  await page.locator('#appbar button', { hasText: 'Download' }).click();
  await reach(3, 'studio 5: Download opens the choices and advances');
  await page.locator('.mbox button', { hasText: 'Close' }).click();
  await reach(4, 'studio 5: closing the download box advances');
  await page.locator('#appbar button', { hasText: 'Share' }).click();
  await reach(5, 'studio 5: Share opens the share box and advances');
  ok(/Great songs may be picked to play in one of our games: share yours in #music/.test(await page.locator('.mbox').innerText()), 'share: the dialog says songs may be picked for the games');
  await page.locator('.mbox button', { hasText: 'OK' }).click();
  await reach(6, 'studio 5: closing the share box advances');
  await next(); await reach(7, 'studio 5: launcher music explained');
  ok(/could be in a game/i.test(await page.locator('#tut .tut-bubble').innerText()), 'studio 5: the last step says your song could be in a game');
  await next();
  ts = await T();
  ok(ts.finale && /share yours in #music/.test(await page.locator('#tut .tut-bubble').innerText()), 'studio 5: finishes with the #music message');
  await page.locator('#tut .tut-skip', { hasText: 'Close' }).click();
  ok(!(await T()).active && (await ev(() => window.__beatlab.project.id)) === kept.id, 'studio 5: Close stays on the kept song');
  ts = await T();
  ok(['simple1', 'studio1', 'studio2', 'studio3', 'studio4', 'studio5'].every(id => ts.done[id] === 1), 'tutorials: all six lessons remembered as done', ts.done);
  await page.locator('#appbar .learn').click();
  ok(await page.locator('.learn .lrow.done').count() === 6, 'learn hub: all six ticked');
  await page.locator('.mbox button', { hasText: 'Close' }).click();
  await page.locator('#appbar button', { hasText: 'Projects' }).click();
  ok(/Your song could be in a game/.test(await page.locator('.mbox').innerText()), 'projects screen: says your song could be in a game');
  await page.locator('.mbox button', { hasText: 'Close' }).click();

  // ---- Skip and Esc leave every lesson at any step, and put the player's song back
  await ev(id => window.__beatlab.load(localStorage.getItem('beatlab_p_' + id)), mine.id);
  const ids = (await ev(() => window.__beatlab.tut.lessons())).map(l => [l.id, l.steps]);
  for (let i = 0; i < ids.length; i++) {
    const [id, n] = ids[i], k = (i * 3 + 2) % n;
    await ev(id => window.__beatlab.tut.start(id), id);
    for (let j = 0; j < k; j++) await ev(() => window.__beatlab.tut.next());
    if (i % 2) await page.locator('#tut .tut-skip').click(); else await page.keyboard.press('Escape');
    const s = await ev(() => ({ active: window.__beatlab.tut.state.active, id: window.__beatlab.project.id, overlay: !!document.querySelector('#tut') }));
    ok(!s.active && !s.overlay && s.id === mine.id, 'tutorials: ' + (i % 2 ? 'Skip' : 'Esc') + ' at step ' + (k + 1) + ' of ' + id + ' leaves and restores the song', s);
  }
  const after0 = await savedSongs();
  const newKeys = Object.keys(after0).filter(k => !(k in before0)), changedKeys = Object.keys(before0).filter(k => after0[k] !== before0[k]);
  ok(changedKeys.length === 0 && newKeys.length === 1 && newKeys[0] === 'beatlab_p_' + kept.id, 'tutorials: the player\'s saved songs are untouched (only the kept practice song is new)', { changedKeys, newKeys });

  // ---- the "?" helper: point at a Studio panel for a one-line explanation
  await page.locator('#appbar .qbtn').click();
  const bb = await page.locator('#browser').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 40);
  await page.mouse.move(bb.x + bb.width / 2 + 4, bb.y + bb.height - 44);
  const tip = await page.locator('#tut-tip.show').innerText().catch(() => '');
  ok(/Sound browser/.test(tip), 'the ? helper explains a panel on hover', tip);
  await page.locator('#appbar .qbtn').click();
  ok(await ev(() => !document.querySelector('#tut-tip.show') && !document.body.classList.contains('explain')), 'the ? helper turns off again');
  }
  ok(errs.length === 0, 'no script errors during the run', errs.slice(0, 5));
  const le = await ev(() => window.__beatlab.lastError);
  ok(!le, 'debug hook reports no last error', le);
} catch (e) { console.log('FAIL  test crashed: ' + e.message); fails++; }
await browser.close(); server.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
