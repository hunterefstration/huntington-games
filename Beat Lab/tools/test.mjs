// Beat Lab browser test: both modes open, demos play, editing, undo/redo, save/load, WAV render, simple -> studio.
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
  ok(st.mode === 'studio' && c.channels === 5 && c.notes + c.steps === before.melody + before.drums, 'Open in Studio makes a full project with every note', { st: st.mode, c, before });

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
  await page.locator('#appbar button', { hasText: 'Export' }).click();
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
  ok(errs.length === 0, 'no script errors during the run', errs.slice(0, 5));
  const le = await ev(() => window.__beatlab.lastError);
  ok(!le, 'debug hook reports no last error', le);
} catch (e) { console.log('FAIL  test crashed: ' + e.message); fails++; }
await browser.close(); server.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
