// "Away for 30 minutes pauses progress" in the idle games: Brown E Clicker (classic + rebalanced), Coffee Shop NEW (Bean & Brew 2.2),
// Coffee Shop Tycoon Legacy and Market Life. Per game: progress grows while you are active; with the AFK limit shortened
// (window.__hgAfkMs) it stops after the limit with no input and the banner shows; an input resumes it; a save with an old
// timestamp gives at most 30 minutes of offline progress (games with offline earnings); no script errors.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/afk-idle.mjs [base-url]
// base-url defaults to http://127.0.0.1:8090 (any static server of the repo works; localhost skips the licence gate).
import { chromium } from 'playwright';
const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '');
const b = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, name, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (!c && extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const errors = [];
const AFK = 2500; // shortened limit for the tests

async function open(tag, path, { afk, seed } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errors.push(tag + ': ' + e.message); console.log('  [pageerror ' + tag + ']', e.message.slice(0, 200)); });
  await p.route(/fonts\.|unpkg|cdn\./, r => r.abort());
  await p.addInitScript(([afk, seed]) => {
    if (afk) window.__hgAfkMs = afk;
    if (seed && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const k in seed) localStorage.setItem(k, seed[k]); }
  }, [afk || 0, seed || null]);
  await p.goto(BASE + path);
  return p;
}
const banner = p => p.evaluate(() => !!document.getElementById('hg-afk-banner'));

// the common AFK sequence; measure() returns a number that only grows through automatic progress
async function afkSequence(tag, p, measure, { win = 1500 } = {}) {
  const a0 = await measure(p); await sleep(win); const a1 = await measure(p);
  ok(a1 > a0, tag + ': progress grows while active', [a0, a1]);
  ok(!(await banner(p)), tag + ': no banner while active');
  await sleep(AFK + 600);                       // no input at all for longer than the limit
  ok(await banner(p), tag + ': banner shows after the limit');
  ok((await p.evaluate(() => document.getElementById('hg-afk-banner').textContent)).includes('Away for 30 minutes: progress paused'), tag + ': banner text');
  await sleep(300);
  const p0 = await measure(p); await sleep(win + 1600); const p1 = await measure(p);
  ok(p1 === p0, tag + ': progress stopped while away', [p0, p1]);
  await p.keyboard.press('Shift');
  ok(!(await banner(p)), tag + ': banner gone after an input');
  const r0 = await measure(p); await sleep(win + 1600); const r1 = await measure(p);
  ok(r1 > r0, tag + ': progress resumes after an input', [r0, r1]);
  // wiggling the mouse keeps you active
  await sleep(AFK - 800);
  await p.mouse.move(300, 300); await sleep(1100); await p.mouse.move(340, 320); await sleep(AFK - 800);
  ok(!(await banner(p)), tag + ': mouse movement counts as input');
}

// ---------- Brown E Clicker (classic and rebalanced beta) ----------
for (const variant of ['classic', 'rb']) {
  const tag = 'brownE-' + variant, path = '/Brown%20E%20Clicker/index.html' + (variant === 'rb' ? '?variant=rb' : '');
  const startBE = async p => {
    await p.waitForFunction(() => !!window.__clicker, null, { timeout: 20000 });
    await p.evaluate(() => { __clicker.give(1e5); __clicker.buy(0); __clicker.buy(0); __clicker.recalc(); });
    await p.click('#start-btn');
  };
  const p = await open(tag, path, { afk: AFK });
  await startBE(p);
  ok(await p.evaluate(() => __clicker.state.bps > 0), tag + ': has idle income');
  await afkSequence(tag, p, p => p.evaluate(() => __clicker.state.life.earned));
  // offline: a save from 5 hours ago counts like one from 30 minutes ago
  const save = await p.evaluate(() => localStorage.getItem(__clicker.saveKey));
  const key = await p.evaluate(() => __clicker.saveKey);
  await p.context().close();
  const gain = async hours => {
    const d = JSON.parse(save); d.t = Date.now() - hours * 3600 * 1000;
    const q = await open(tag + '-off' + hours, path, { seed: { [key]: JSON.stringify(d) } });
    await q.waitForFunction(() => !!window.__clicker, null, { timeout: 20000 });
    await q.click('#start-btn');
    const r = await q.evaluate(() => ({ off: __clicker.state.life.offlineEarned, txt: document.getElementById('welcome-detail').textContent, bps: __clicker.state.bpsBase }));
    await q.context().close(); return r;
  };
  const g5 = await gain(5), g05 = await gain(0.5);
  ok(g05.off > 0 && g5.off <= g05.off * 1.02 + 1, tag + ': 5 h away counts like 30 min', { g5: g5.off, g05: g05.off });
  ok(/at most 30 minutes count/.test(g5.txt), tag + ': welcome popup mentions the 30 minute limit', g5.txt);
}

// ---------- Coffee Shop NEW ----------
{
  const tag = 'coffeeNEW', path = '/Coffee%20Shop%20NEW/index.html';
  const p = await open(tag, path, { afk: AFK });
  await p.waitForFunction(() => !!window.__coffee, null, { timeout: 20000 });
  await p.click('[data-act="m-new"]');
  await sleep(500);
  await afkSequence(tag, p, p => p.evaluate(() => __coffee.state.tick));
  // offline: add a franchise (it earns while you are away), then reopen with old save times
  await p.evaluate(() => { __coffee.state.franchises.push({ id: 'f1', city: 'home', name: 'Test Express', lv: 8, mgr: 3, mname: 'Sam', paid: 1000, earned: 0, acc: 0 }); __coffee.save(); });
  const key = 'beanBrewSaveV2';
  const save = await p.evaluate(k => localStorage.getItem(k), key);
  await p.context().close();
  const gain = async hours => {
    const d = JSON.parse(save); d.savedAt = Date.now() - hours * 3600 * 1000;
    const q = await open(tag + '-off' + hours, path, { seed: { [key]: JSON.stringify(d) } });
    await q.waitForFunction(() => !!window.__coffee, null, { timeout: 20000 });
    const m0 = d.globalMoney !== undefined ? d.globalMoney : (d.state && d.state.globalMoney);
    await q.click('[data-act="m-continue"]'); await sleep(400);
    const r = await q.evaluate(() => ({ m: __coffee.state.globalMoney, txt: document.body.innerText, dlg: __coffee.dlg }));
    await q.context().close(); return { gain: r.m - m0, txt: r.txt, dlg: r.dlg };
  };
  const g5 = await gain(5), g05 = await gain(0.5);
  ok(g05.gain > 0 && g5.gain <= g05.gain * 1.05 + 1, tag + ': 5 h away counts like 30 min', { g5: g5.gain, g05: g05.gain });
  ok(/at most 30 minutes count/.test(g5.txt), tag + ': away popup mentions the 30 minute limit', g5.dlg);
}

// ---------- Coffee Shop Tycoon Legacy (idle baristas; it has no save, so no offline earnings) ----------
{
  const tag = 'coffeeLegacy', p = await open(tag, '/Coffee%20Shop%20Tycoon%20Legacy/index.html', { afk: AFK });
  await p.evaluate(() => { state.baristas = 3; state.marketingLevel = 2; state.beans = 5000; state.milk = 5000; state.cups = 5000; });
  await afkSequence(tag, p, p => p.evaluate(() => state.money), { win: 2300 });
}

// ---------- Market Life (days pass on a timer; it has no offline earnings) ----------
{
  const tag = 'marketLife', p = await open(tag, '/Market%20Life%201.9/index.html', { afk: AFK });
  await p.waitForFunction(() => !!window.__market, null, { timeout: 20000 });
  await p.click('[data-act="startLife"]'); await sleep(300);
  await p.click('[data-act="speed"][data-arg="8"]');
  await afkSequence(tag, p, p => p.evaluate(() => __market.state.day), { win: 1200 });
}

ok(errors.length === 0, 'no script errors', errors.slice(0, 5));
await b.close();
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
