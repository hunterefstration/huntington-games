
// ===== Admin: rebuild someone's lost progress from what the server still knows =====
// The leaderboards keep every account's best numbers (each Last Light level's best time, Blocky XP, Brown E's made...) and
// the server keeps every achievement an account claimed. After a save was lost, those can be written back into the
// account's saves: only ever RAISING a number, never lowering one, and the server keeps whatever it replaces ('~pre:').
// What the boards do not say cannot come back: which Last Light levels were flawless, stars on the others, the exact
// Brown E Clicker run (its heavenly chips come back as at least what one run of the lifetime total would give).
var RB_LUMI = (function () { var a = []; for (var w = 1; w <= 4; w++) for (var n = 1; n <= 10; n++) a.push(w + '-' + n); a.push('5-1'); return a; })();
var RB_GIVES = { '1-10': 'double', '2-10': 'wall', '3-10': 'dash' };
function rbJ(v) { try { var o = JSON.parse(v); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function rbN(v) { v = Number(v); return isFinite(v) ? v : 0; }
function rbMax(o, k, v) { if (!(v > 0)) return false; if (!(rbN(o[k]) >= v)) { o[k] = v; return true; } return false; }
function rbObj(o, k) { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; return o[k]; }
// boards: [{ key, s, d }]; cur: { saveKey: value }; ach: [ids]. Returns { saves: { key: newValue }, notes: [text] }
function rbBuild(boards, cur, ach) {
  var B = {}, out = {}, notes = [];
  boards.forEach(function (b) { B[b.key] = b; });
  var edit = function (key, make, fn) {
    var had = cur[key] != null && cur[key] !== '', o = had ? rbJ(cur[key]) : null;
    if (had && !o) return;                                         // not something we can read: leave it alone
    if (!o) { if (!make) return; o = make(); }
    if (fn(o)) out[key] = JSON.stringify(o);
  };
  // Last Light: every level with a time is finished, with at least that time; the guardians' abilities come with them
  var lumi = RB_LUMI.filter(function (id) { return B['lumi:lv' + id]; });
  if (lumi.length || B['lumi:onelife']) edit('lumi_save', function () { return { v: 3, levels: {}, abilities: { double: false, wall: false, dash: false }, deaths: 0, sparks: 0, playTime: 0 }; }, function (o) {
    var ch = false, lv = rbObj(o, 'levels'), ab = rbObj(o, 'abilities');
    lumi.forEach(function (id) {
      var t = rbN(B['lumi:lv' + id].s), r = lv[id];
      if (!r || typeof r !== 'object') { r = lv[id] = { best: null, moths: [false, false, false], sparks: 0, clears: 0 }; ch = true; }
      if (!Array.isArray(r.moths)) { r.moths = [false, false, false]; ch = true; }
      if (t > 0 && (r.best == null || !(rbN(r.best) <= t))) { r.best = t; ch = true; }
      if (!(rbN(r.clears) >= 1)) { r.clears = 1; ch = true; }
      if (RB_GIVES[id] && !ab[RB_GIVES[id]]) { ab[RB_GIVES[id]] = true; ch = true; }
    });
    var fl = B['lumi:flawless'] ? rbN(B['lumi:flawless'].s) : 0;
    if (fl > 0 && fl >= lumi.length) lumi.forEach(function (id) { var r = lv[id]; if (!r.perfect) { r.perfect = true; r.flawless = true; r.moths = [true, true, true]; ch = true; } });   // every finished level was flawless: so all of them
    if (B['lumi:onelife']) { var ru = rbObj(o, 'runs'); if (rbMax(ru, 'onelife', rbN(B['lumi:onelife'].s))) ch = true; }
    if (ch) notes.push('Last Light: ' + lumi.length + ' finished levels with their best times' + (fl > 0 && fl < lumi.length ? ' (which ' + fl + ' were flawless is not known)' : ''));
    return ch;
  });
  // Blocky Shooter: XP over every prestige (49 ranks of 600 + 200r), kills, best waves
  var PER = 274400;
  if (B['blocky:xp'] || B['blocky:kills'] || B['blocky:wave']) edit('blocky21_life', function () { return {}; }, function (o) {
    var ch = false, tot = rbN(o.prestige) * PER + rbN(o.xp), want = B['blocky:xp'] ? rbN(B['blocky:xp'].s) : 0;
    if (want > tot) { o.prestige = Math.floor(want / PER); o.xp = want - o.prestige * PER; ch = true; }
    if (B['blocky:kills']) { if (rbMax(o, 'kills', rbN(B['blocky:kills'].s))) ch = true; if (B['blocky:kills'].d && rbMax(o, 'headshots', rbN(B['blocky:kills'].d.headshots))) ch = true; }
    if (B['blocky:wave']) { var best = rbObj(o, 'best'), md = (B['blocky:wave'].d && B['blocky:wave'].d.mode) || 'classic'; if (rbMax(best, md, rbN(B['blocky:wave'].s))) ch = true; }
    if (ch) notes.push('Blocky Shooter: rank and prestige, kills, best wave');
    return ch;
  });
  // Brown E Clicker (classic and Rebalanced): Brown E's ever made, ascensions, and heavenly chips of at least one run's worth
  [['brownEClickerSave', 'clicker:total', 'clicker:asc', 1e9, 1 / 3, 'Brown E Clicker'], ['brownEClickerSave_rb', 'clicker:rb', null, 1.2e11, 0.2, 'Brown E Clicker Rebalanced']].forEach(function (c) {
    if (!B[c[1]] && !(c[2] && B[c[2]])) return;
    edit(c[0], null, function (o) {
      var ch = false, life = rbObj(o, 'life'), meta = rbObj(o, 'meta'), earned = B[c[1]] ? rbN(B[c[1]].s) : 0;
      if (rbMax(life, 'earned', earned)) ch = true;
      var asc = Math.max(c[2] && B[c[2]] ? rbN(B[c[2]].s) : 0, B[c[1]] && B[c[1]].d ? rbN(B[c[1]].d.ascensions) : 0);
      if (rbMax(meta, 'ascensions', asc)) ch = true;
      var chips = earned >= c[3] ? Math.floor(Math.pow(earned / c[3], c[4])) : 0;
      if (asc > 0 && chips > rbN(meta.chipsTotal)) { meta.chips = rbN(meta.chips) + (chips - rbN(meta.chipsTotal)); meta.chipsTotal = chips; ch = true; }
      if (ch) notes.push(c[5] + ': Brown E\'s made, ascensions and heavenly chips');
      return ch;
    });
  });
  // the rest: simple bests and totals
  var simple = [
    ['spikes100_progress', [['spikes:level', 'unlocked'], ['spikes:onelife', 'bestOneLife'], ['spikes:endless', 'bestEndless']], '50 Levels of Spikes'],
    ['td2_records', [['td:best', 'best'], ['td:endless', 'bestEndless']], 'Tower Defense'],
    ['mayhem_save', [['mayhem:crowns', 'stats.crowns'], ['mayhem:qualified', 'stats.qualified']], 'Mayhem Marathon'],
    ['steelstorm_save', [['steel:wins', 'stats.wins'], ['steel:kills', 'stats.kills']], 'Steel Storm'],
    ['frontline_profile_v2', [['frontline:wins', 'wins']], 'Frontline'],
    ['huntingtonTetrisSurge1', [['tetris:lines', 'stats.lines'], ['tetris:floor', 'stats.bestFloor']], 'Tetris'],
    ['beanBrewSaveV2', [['coffee:best', 'stats.earned']], 'Bean & Brew']
  ];
  simple.forEach(function (g) {
    if (!g[1].some(function (x) { return B[x[0]]; })) return;
    edit(g[0], null, function (o) {
      var ch = false;
      g[1].forEach(function (x) { if (!B[x[0]]) return; var p = x[1].split('.'), t = o; for (var i = 0; i < p.length - 1; i++) t = rbObj(t, p[i]); if (rbMax(t, p[p.length - 1], rbN(B[x[0]].s))) ch = true; });
      if (ch) notes.push(g[2] + ': best scores and totals');
      return ch;
    });
  });
  [['netWorthPB', 'market:worth'], ['lifeScorePB', 'market:score']].forEach(function (x) {
    if (B[x[1]] && !(rbN(cur[x[0]]) >= rbN(B[x[1]].s))) { out[x[0]] = String(rbN(B[x[1]].s)); notes.push('Market & Life: ' + (x[0] === 'netWorthPB' ? 'best net worth' : 'best life score')); }
  });
  // achievements the server has on record
  if (ach && ach.length) {
    var got = rbJ(cur['hgach:v1']) || {}, add = 0;
    ach.forEach(function (id) { if (!got[id]) { got[id] = Date.now(); add++; } });
    if (add) { out['hgach:v1'] = JSON.stringify(got); notes.push(add + ' achievements'); }
  }
  return { saves: out, notes: notes };
}
var RB_KEYS = ['lumi_save', 'blocky21_life', 'brownEClickerSave', 'brownEClickerSave_rb', 'spikes100_progress', 'td2_records', 'mayhem_save', 'steelstorm_save', 'frontline_profile_v2', 'huntingtonTetrisSurge1', 'beanBrewSaveV2', 'netWorthPB', 'lifeScorePB', 'hgach:v1'];
// the admin panel: preview, then write
function rbRun(name, look, out, apply) {
  var L = window.HGGrapevine;
  out.textContent = 'Reading their saves...';
  return L.eco.savesAdminGet(name, RB_KEYS).then(function (r) {
    if (!r.ok) throw new Error(r.err || 'Could not read their saves.');
    var cur = {}; (r.values || []).forEach(function (x) { cur[x.k] = x.v; });
    var plan = rbBuild(look.boards || [], cur, look.achIds || []), keys = Object.keys(plan.saves);
    if (!keys.length) { out.textContent = 'Nothing to rebuild: their saves already hold at least what the leaderboards and achievements say.'; return null; }
    if (!apply) {
      out.innerHTML = '<b>Rebuild for ' + profEsc(look.name) + ':</b><br>' + plan.notes.map(profEsc).join('<br>') + '<br><button class="pb" data-padm="rebuild-go">Write these ' + keys.length + ' save(s)</button>';
      return plan;
    }
    return L.eco.savesAdminPut(name, keys.map(function (k) { return { k: k, v: plan.saves[k] }; })).then(function (w) {
      out.textContent = w.ok ? 'Rebuilt ' + w.written + ' save(s) for ' + look.name + '. They load on their device within a minute (or when they close the game). The replaced copies are kept on the server.' : (w.err || 'Could not write them.');
      return w;
    });
  }).catch(function (e) { out.textContent = String(e && e.message || e); });
}
