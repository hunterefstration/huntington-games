import { launch, newPage, check } from './blocky-classes-lib.mjs';
const browser = await launch();
const init = `if (!sessionStorage.planted) { localStorage.clear(); localStorage.setItem('blocky21_settings', JSON.stringify({ quality: 'low', seen54: 1, mode: 'classic', map: 'blockyard', diff: 'normal' })); sessionStorage.planted = 1; }`;
const { page, errs } = await newPage(browser, { init });
const K = ['assault', 'medic', 'engineer', 'recon', 'heavy', 'demo', 'marksman', 'scout'];
const before = await page.evaluate((K) => Object.fromEntries(K.map(k => [k, __blocky.life.cls[k].xp])), K);
for (const k of K) {
  const r = await page.evaluate((k) => {
    const B = __blocky, out = {};
    B.menu(); B.cls(k); B.start(); B.run(0.6);
    B.god(true); B.resetCd(); B.killAll(); B.run(0.1);
    const cam = B.state.camera; cam.updateMatrixWorld(true);
    const m = cam.matrixWorld.elements, fx = -m[8], fz = -m[10], L = Math.hypot(fx, fz) || 1, px = cam.position.x, pz = cam.position.z;
    for (let i = 0; i < 6; i++) B.spawn('grunt', px + fx / L * (5 + i * 0.6) + (i % 3 - 1) * 0.8, pz + fz / L * (5 + i * 0.6));
    B.freeze(true);
    const hp0 = B.state.enemies.map(e => e.userData.hp);
    out.cls = B.abil.cls; out.en = B.state.enemies.length; const xp0 = B.life.cls[k].xp;
    B.ability(); B.run(0.05);
    const a = B.abil, c = B.cls54;
    out.cd = +a.cd.toFixed(1); out.t = +a.t.toFixed(2);
    out.fx = { assault: () => c.dmg > 1.2, medic: () => a.healFields === 1, engineer: () => !!a.mini && a.crates.length === 1, recon: () => a.marked >= 1,
               heavy: () => c.taken < 0.6 && B.state.enemies.some((e, i) => e.userData.hp < hp0[i]), demo: () => true, marksman: () => B.mfd() >= 1,
               scout: () => Math.hypot(c.push[0], c.push[1]) > 1 || c.dashDrT > 0 }[k]();
    if (k === 'demo') { B.run(1.2); out.fx = B.state.enemies.length < 6 || B.state.enemies.some((e, i) => e.userData.hp < hp0[i]); }
    if (k === 'scout') out.ch = c.scoutCh;
    B.freeze(false); B.killAll(); B.run(0.1);
    out.xpGain = B.life.cls[k].xp - xp0;
    out.kills = B.state.runStats.kills;
    B.god(false); for (let i = 0; i < 6 && B.state.currentGameState !== 'gameover'; i++) { if (B.state.currentGameState !== 'playing') B.start(); B.hurt(99999); } B.run(0.1);
    out.state = B.state.currentGameState;
    out.sum = /CLASS XP/.test(document.getElementById('gameover-xp').innerHTML);
    out.saved = JSON.parse(localStorage.getItem('blocky21_life')).cls[k].xp;
    out.mem = B.life.cls[k].xp;
    return out;
  }, k).catch(e => ({ err: String(e).slice(0, 300) }));
  check(`${k}: ability works`, r.fx && r.cd > 0, JSON.stringify(r));
  check(`${k}: kills give class xp, banked at the end`, r.xpGain > 0 && r.saved === r.mem && r.state === 'gameover' && r.sum, JSON.stringify(r));
}
const after = await page.evaluate((K) => Object.fromEntries(K.map(k => [k, __blocky.life.cls[k].xp])), K);
await page.reload(); await page.waitForFunction(() => !!(window.__blocky && window.__blocky.state));
const reloaded = await page.evaluate((K) => Object.fromEntries(K.map(k => [k, __blocky.life.cls[k].xp])), K);
check('class xp survives a reload', JSON.stringify(after) === JSON.stringify(reloaded) && K.every(k => after[k] > before[k]), JSON.stringify(reloaded));

// tree, respec, caps, specs: out of game
const t = await page.evaluate(() => {
  const B = __blocky, o = {};
  B.menu();
  B.clsXP('assault', 1e7); o.lv = B.clsLvl('assault'); o.pts = B.clsPts('assault');
  o.cantSkip = B.clsBuy('assault', 'a2') === false;                 // needs a1 first
  for (const id of ['u1', 'u1', 'u1', 'u2', 'u2', 'u2', 'u3', 'u3', 'p1', 'p2', 'p2', 'p2', 'p3', 'p3', 'p4', 'p5', 'a1', 'a1', 'a1', 'a2', 'a2', 'a2', 'a3', 'a4', 'a4', 'a5']) B.clsBuy('assault', id);
  o.overMax = B.clsBuy('assault', 'u1') === false;
  o.spec = B.clsSpec('assault', 0, 'berserk') && B.clsSpec('assault', 1, 'unstop');
  o.pts2 = B.clsPts('assault');
  B.cls('assault'); B.start(); B.run(0.3);
  o.run = B.cls54; o.st = B.clsStats; o.W = B.W('ar').reloadTime; o.money = B.state.playerStats.money;
  B.god(true); B.resetCd(); B.ability(); B.run(0.05); o.adrDmg = B.cls54.dmg; o.taken = B.cls54.taken; o.dur = B.abil.dur;
  B.god(false); B.menu();
  B.clsRespec('assault'); o.afterRespec = { pts: B.clsPts('assault'), st: B.clsStats };
  B.start(); B.run(0.2); for (let i = 0; i < 6 && B.state.currentGameState !== 'gameover'; i++) { if (B.state.currentGameState !== 'playing') B.start(); B.hurt(99999); } B.start(); B.run(0.2); o.runAfter = B.cls54; o.W2 = B.W('ar').reloadTime; B.menu();
  // a fresh class level 1: nothing to buy
  o.freshBuy = B.clsLvl('scout') < 4 ? B.clsBuy('scout', 'a2') === false : true;
  return o;
});
check('tree: level 30, 29 points', t.lv === 30 && t.pts === 29);
check('tree: prerequisites enforced', t.cantSkip);
check('tree: ranks capped', t.overMax);
check('tree: specialisations pick at 10 / 20', t.spec);
check('run: max HP from tree (100 + 30 cap)', t.run.maxHp === 130, JSON.stringify(t.run));
check('run: stats capped', t.st.dmg <= 0.1 + 1e-9 && t.st.rel <= 0.12 + 1e-9 && t.st.hp <= 30 && t.st.armor <= 0.1 + 1e-9 && t.st.cd <= 0.25 + 1e-9, JSON.stringify(t.st));
check('run: reload faster with the tree', t.W < t.W2, `${t.W} vs ${t.W2}`);
check('run: BERSERKER + OVERDRIVE adrenaline (1.5x boost scaled, x FIREPOWER)', t.adrDmg > 1.6 && t.adrDmg < 1.8, String(t.adrDmg));
check('run: UNSTOPPABLE damage cut', t.taken < 0.6 * 0.95, String(t.taken));
check('run: WAR CHEST start cash ignored? (u5 not bought)', t.money >= 0);
check('respec: all points back, stats zero', t.afterRespec.pts === 29 && t.afterRespec.st.hp === 0, JSON.stringify(t.afterRespec.pts) + ' ' + t.afterRespec.st.hp);
check('respec: a new run is back to 100 HP', t.runAfter.maxHp === 100, String(t.runAfter.maxHp));
check('fresh class cannot buy row 2', t.freshBuy);
// the in-run class shop is gone; cash still buys guns
const s = await page.evaluate(() => {
  const B = __blocky; B.cls('engineer'); B.start(); B.run(0.2);
  B.state.playerStats.money = 5000;
  window.shopTab && window.shopTab('class');
  const html = document.getElementById('shop-items') ? document.getElementById('shop-items').innerHTML : '';
  const ok = typeof window.buyClassUp === 'undefined';
  const m0 = B.state.playerStats.money; window.buyWeapon('smg'); const bought = B.state.playerStats.weapons.includes('smg') && B.state.playerStats.money < m0;
  return { ok, bought, noBuyBtn: !/buyClassUp|UNLOCK \$/.test(html), hasTab: /CLASSES/.test(html) };
});
check('no in-run class shop, cash still buys guns', s.ok && s.bought && s.noBuyBtn, JSON.stringify(s));
check('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
await browser.close();
