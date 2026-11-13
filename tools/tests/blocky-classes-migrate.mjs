// Blocky Shooter 5.4 classes: old saves migrate untouched (migrate), every class plays, levels, and keeps its tree (classes).
//   NODE_PATH=/opt/node22/lib/node_modules node tools/tests/blocky-classes-migrate.mjs   (repo served on :8090, no rig needed)
import { launch, newPage, check } from './blocky-classes-lib.mjs';
const shapes = {
  fresh: null,
  mid: { xp: 20000, runs: 30, kills: 2000, headshots: 300, bosses: 4, shots: 9000, hits: 5000, damage: 99999, time: 7200, waves: 200, best: { normal: 12 }, weaponKills: { ar: 900 }, cls: { assault: { runs: 10, kills: 900, best: 12 } }, maps: { mall: { runs: 3, waves: 20, best: 9 } } },
  vet: { xp: 50000, prestige: 3, runs: 400, kills: 30000, headshots: 6000, bosses: 120, shots: 1e5, hits: 6e4, damage: 4e6, time: 2e5, waves: 5000, best: { normal: 40, hard_rush: 22 }, weaponKills: { ar: 9000, smg: 4000 },
         cls: { assault: { runs: 100, kills: 9000, best: 40 }, medic: { runs: 50, kills: 3000, best: 30 }, engineer: { runs: 20, kills: 1000, best: 20 }, recon: { runs: 5, kills: 100, best: 10 } }, maps: {}, tourneyWins: 2, bossSeen: { boss: 1 } },
  odd: { xp: 'lots', kills: 'abc', cls: { assault: 'x', medic: { runs: 'q' }, bogus: { runs: 1 } }, best: [], prestige: 99, extra: { keep: [1, 2, 3] } }
};
const browser = await launch();
for (const [name, life] of Object.entries(shapes)) {
  const init = `if (!sessionStorage.planted) { localStorage.clear(); ${life ? `localStorage.setItem('blocky21_life', ${JSON.stringify(JSON.stringify(life))});` : ''} sessionStorage.planted = 1; }`;
  const { page, ctx, errs } = await newPage(browser, { init });
  const a = await page.evaluate(() => JSON.parse(localStorage.getItem('blocky21_life')));
  const info = await page.evaluate(() => ({ lv: Object.fromEntries(['assault','medic','engineer','recon','heavy','demo','marksman','scout'].map(k => [k, __blocky.clsLvl(k)])), tot: __blocky.clsTotal(), mt: __blocky.mastery() }));
  console.log(name, JSON.stringify(info));
  if (life) {
    // every old top-level field the 4.0 code leaves alone is unchanged
    const skip = name === 'odd' ? ['cls', 'prestige', 'xp', 'best'] : ['cls'];
    const diff = Object.keys(life).filter(k => !skip.includes(k) && JSON.stringify(a[k]) !== JSON.stringify(life[k]));
    check(`${name}: old fields unchanged`, diff.length === 0, diff.join(','));
    if (life.cls && typeof life.cls === 'object') for (const k in life.cls) if (life.cls[k] && typeof life.cls[k] === 'object') {
      const o = life.cls[k], n = a.cls[k];
      check(`${name}: cls.${k} 4.0 stats kept`, ['runs', 'kills', 'best'].every(f => !(f in o) || JSON.stringify(n[f]) === JSON.stringify(o[f])));
    }
  }
  check(`${name}: class block sane`, a && a.clsV === 1 && a.clsTotal === info.tot && Object.values(info.lv).every(l => l >= 1 && l <= 30) && ['heavy','demo','marksman','scout'].every(k => a.cls[k] && Number.isFinite(a.cls[k].xp)));
  // second load: nothing changes
  await page.reload(); await page.waitForFunction(() => !!(window.__blocky && window.__blocky.state));
  const b = await page.evaluate(() => JSON.parse(localStorage.getItem('blocky21_life')));
  check(`${name}: second load identical`, JSON.stringify(a) === JSON.stringify(b));
  check(`${name}: no page errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
