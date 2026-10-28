  // ---- achievements across every game ----
  // Worked out from each game's own save data (the same localStorage keys cloud saves carry), so games do not have to
  // report anything: a save that shows you beat level 100 is the achievement. Unlocks are kept in 'hgach:v1'
  // ({ id: when }), which syncs like a game save, and a summary goes to your Grapevine profile card.
  // Each test is wrapped: a game that changes its save format just stops unlocking that one, nothing breaks.
  // To add one: { id, g (game id), i (icon), n (name), d (how to get it), p (points: 10 / 25 / 50 / 100), t: fn }.
  var AG = { spikes: '100 Levels of Spikes', tetris: 'Tetris Surge', clicker: 'Brown E Clicker', coffee: 'Bean & Brew Tycoon',
    market: 'Market & Life', td: 'Tower Defense', frontline: 'Frontline: Command', blocky: 'Blocky Shooter', neon: 'Neon Dash',
    sov: 'Sovereign', lumi: 'Last Light', hub: 'Huntington Games' };
  function rd(k) { try { var v = localStorage.getItem(k); if (v == null) return null; try { return JSON.parse(v); } catch (e) { return v; } } catch (e) { return null; } }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function cnt(x) { return !x ? 0 : Array.isArray(x) ? x.length : typeof x === 'object' ? Object.keys(x).filter(function (k) { return x[k]; }).length : 0; }
  function sum(o) { var t = 0; if (o && typeof o === 'object') for (var k in o) t += num(o[k]); return t; }
  var SP = function () { return rd('spikes100_progress') || {}; }, TS = function () { return rd('huntingtonTetrisSurge1') || {}; },
      BE = function () { return rd('brownEClickerSave') || {}; }, BB = function () { return rd('beanBrewSaveV2') || {}; },
      ML = function () { var s = rd('marketLifeSave'); return (s && s.life) || {}; }, TDR = function () { return rd('td2_records') || {}; },
      FL = function () { return rd('frontline_profile_v2') || {}; }, BL = function () { return rd('blocky21_life') || {}; },
      SV = function () { return rd('sov.hgach') || {}; }, PL = function () { return rd('hgach:plays') || {}; },
      LU = function () { return rd('lumi_save') || {}; };
  var luDone = function (id) { return !!((LU().levels || {})[id]); }, luMoths = function () { var n = 0, l = LU().levels || {}; for (var k in l) n += (((l[k] || {}).moths) || []).filter(Boolean).length; return n; };
  var careerBest = function (c) { var b = ML().best || {}; return b[c] === undefined ? -1 : num(b[c]); };
  var ACH = [
    // 100 Levels of Spikes
    { id: 'sp10', g: 'spikes', i: '🔺', n: 'Spike Rookie', d: 'Reach level 10.', p: 10, t: function () { return num(SP().unlocked) >= 10; } },
    { id: 'sp25', g: 'spikes', i: '🔺', n: 'Pointy Business', d: 'Reach level 25.', p: 10, t: function () { return num(SP().unlocked) >= 25; } },
    { id: 'sp50', g: 'spikes', i: '🔺', n: 'Halfway to Pain', d: 'Reach level 50.', p: 25, t: function () { return num(SP().unlocked) >= 50; } },
    { id: 'sp75', g: 'spikes', i: '⚙️', n: 'Saw It Coming', d: 'Reach level 75.', p: 25, t: function () { return num(SP().unlocked) >= 75; } },
    { id: 'sp100', g: 'spikes', i: '👑', n: 'Spike Royalty', d: 'Beat all 100 levels.', p: 100, t: function () { return !!SP().beaten; } },
    { id: 'sp1life', g: 'spikes', i: '❤️', n: 'One Life, No Regrets', d: 'Clear 10 levels in One Life mode.', p: 50, t: function () { return num(SP().bestOneLife) >= 10; } },
    { id: 'spend', g: 'spikes', i: '♾️', n: 'Endless Agony', d: 'Reach level 25 in Endless mode.', p: 25, t: function () { return num(SP().bestEndless) >= 25; } },
    // Tetris Surge
    { id: 'ts1', g: 'tetris', i: '🧱', n: 'First Drop', d: 'Play a game of Tetris Surge.', p: 10, t: function () { return num((TS().stats || {}).games) >= 1; } },
    { id: 'ts100', g: 'tetris', i: '🧱', n: 'Line Cook', d: 'Clear 100 lines in total.', p: 10, t: function () { return num((TS().stats || {}).lines) >= 100; } },
    { id: 'ts1000', g: 'tetris', i: '🧱', n: 'Line Master', d: 'Clear 1,000 lines in total.', p: 25, t: function () { return num((TS().stats || {}).lines) >= 1000; } },
    { id: 'ts5000', g: 'tetris', i: '🏗️', n: 'Skyscraper', d: 'Clear 5,000 lines in total.', p: 50, t: function () { return num((TS().stats || {}).lines) >= 5000; } },
    { id: 'tstet', g: 'tetris', i: '4️⃣', n: 'Tetris!', d: 'Clear 25 Tetrises (four lines at once).', p: 25, t: function () { return num((TS().stats || {}).tetrises) >= 25; } },
    { id: 'tsboss', g: 'tetris', i: '👾', n: 'Boss Breaker', d: 'Beat 5 bosses.', p: 25, t: function () { return num((TS().stats || {}).bosses) >= 5; } },
    { id: 'tscombo', g: 'tetris', i: '🔥', n: 'Combo Chain', d: 'Hit a 10x combo.', p: 50, t: function () { return num((TS().stats || {}).maxCombo) >= 10; } },
    { id: 'tsach', g: 'tetris', i: '🏅', n: 'Trophy Shelf', d: 'Earn 20 of Tetris Surge\'s own achievements.', p: 50, t: function () { return cnt(TS().ach) >= 20; } },
    // Brown E Clicker
    { id: 'be1k', g: 'clicker', i: '🟤', n: 'Clicker', d: 'Hold 1,000 Brown Es.', p: 10, t: function () { return num((BE().state || {}).brownEs) >= 1e3; } },
    { id: 'be1m', g: 'clicker', i: '🟤', n: 'Millionaire E', d: 'Hold a million Brown Es.', p: 25, t: function () { return num((BE().state || {}).brownEs) >= 1e6; } },
    { id: 'be1b', g: 'clicker', i: '💰', n: 'Billion E Club', d: 'Hold a billion Brown Es.', p: 50, t: function () { return num((BE().state || {}).brownEs) >= 1e9; } },
    { id: 'be100b', g: 'clicker', i: '🏙️', n: 'Empire of E', d: 'Own 100 buildings.', p: 25, t: function () { return (BE().shopItems || []).reduce(function (t, x) { return t + num(x && x.owned); }, 0) >= 100; } },
    { id: 'beasc', g: 'clicker', i: '✨', n: 'Ascended', d: 'Ascend once.', p: 50, t: function () { return num((BE().meta || {}).ascensions) >= 1; } },
    { id: 'beasc5', g: 'clicker', i: '🌌', n: 'Beyond the E', d: 'Ascend 5 times.', p: 100, t: function () { return num((BE().meta || {}).ascensions) >= 5; } },
    { id: 'beach', g: 'clicker', i: '🏅', n: 'Collector', d: 'Earn 50 of Brown E Clicker\'s own achievements.', p: 50, t: function () { return cnt(BE().achievements) >= 50; } },
    // Bean & Brew
    { id: 'bb100', g: 'coffee', i: '☕', n: 'First Rush', d: 'Serve 100 customers.', p: 10, t: function () { return num((BB().stats || {}).served) >= 100; } },
    { id: 'bb1000', g: 'coffee', i: '☕', n: 'Coffee Machine', d: 'Serve 1,000 customers.', p: 25, t: function () { return num((BB().stats || {}).served) >= 1000; } },
    { id: 'bb10k', g: 'coffee', i: '💵', n: 'Bean Counter', d: 'Earn $10,000.', p: 10, t: function () { return num((BB().stats || {}).earned) >= 1e4; } },
    { id: 'bb1m', g: 'coffee', i: '💎', n: 'Latte Millionaire', d: 'Earn $1,000,000.', p: 50, t: function () { return num((BB().stats || {}).earned) >= 1e6; } },
    { id: 'bbshops', g: 'coffee', i: '🏪', n: 'Chain Store', d: 'Run 3 shops.', p: 25, t: function () { return (BB().locations || []).length >= 3; } },
    { id: 'bbcities', g: 'coffee', i: '🗺️', n: 'Coast to Coast', d: 'Open shops in all 6 cities.', p: 50, t: function () { var c = {}; (BB().locations || []).forEach(function (l) { if (l && l.city) c[l.city] = 1; }); return Object.keys(c).length >= 6; } },
    { id: 'bbrec', g: 'coffee', i: '📖', n: 'Recipe Book', d: 'Discover 20 recipes.', p: 25, t: function () { return cnt(BB().recipes) >= 20; } },
    { id: 'bblocal', g: 'coffee', i: '⭐', n: 'Local Legend', d: 'Discover a local special (they only sell in their own city).', p: 10, t: function () { var r = BB().recipes || {}; return ['maplelatte', 'maplescone', 'studybuddy', 'oatcookie', 'cocoiced', 'cocosmoothie', 'smores', 'smoresbar', 'nitrocb', 'nitrovan', 'goldcocoa', 'goldtruffle'].some(function (k) { return r[k]; }); } },
    { id: 'bbfr', g: 'coffee', i: '🏢', n: 'Franchise Boss', d: 'Own a franchise outlet.', p: 25, t: function () { return (BB().franchises || []).length >= 1; } },
    // Market & Life
    { id: 'mlscore', g: 'market', i: '📈', n: 'Good Life', d: 'Finish with a Life Score of 10,000.', p: 10, t: function () { return num(rd('lifeScorePB')) >= 1e4; } },
    { id: 'mlscore2', g: 'market', i: '🌟', n: 'Great Life', d: 'Finish with a Life Score of 50,000.', p: 50, t: function () { return num(rd('lifeScorePB')) >= 5e4; } },
    { id: 'ml100k', g: 'market', i: '💵', n: 'Six Figures', d: 'Reach a net worth of $100,000.', p: 10, t: function () { return num(rd('netWorthPB')) >= 1e5; } },
    { id: 'ml1m', g: 'market', i: '💰', n: 'Millionaire', d: 'Reach a net worth of $1,000,000.', p: 25, t: function () { return num(rd('netWorthPB')) >= 1e6; } },
    { id: 'ml10m', g: 'market', i: '🏝️', n: 'Private Island Money', d: 'Reach a net worth of $10,000,000.', p: 100, t: function () { return num(rd('netWorthPB')) >= 1e7; } },
    { id: 'mlmast', g: 'market', i: '🎓', n: 'Master Class', d: 'Earn a master\'s degree.', p: 25, t: function () { return (ML().degrees || []).some(function (d) { return /^m_|^jd$|^md$|^phd$/.test(d); }); } },
    { id: 'mlrotc', g: 'market', i: '⭐', n: 'Commissioned', d: 'Become a military officer (Academy, ROTC or OTS).', p: 25, t: function () { return careerBest('officer') >= 0; } },
    { id: 'mlgen', g: 'market', i: '🎖️', n: 'Four Stars', d: 'Make General.', p: 100, t: function () { return careerBest('officer') >= 7; } },
    { id: 'mlsgm', g: 'market', i: '🪖', n: 'Sergeant Major', d: 'Rise to Sergeant Major as an enlisted soldier.', p: 50, t: function () { return careerBest('army') >= 7; } },
    // Tower Defense
    { id: 'td1', g: 'td', i: '🗼', n: 'Tower Builder', d: 'Play a game of Tower Defense.', p: 10, t: function () { return num(TDR().games) >= 1; } },
    { id: 'tdkill', g: 'td', i: '💥', n: 'Exterminator', d: 'Defeat 10,000 enemies in total.', p: 25, t: function () { return num(TDR().kills) >= 1e4; } },
    { id: 'tdstar', g: 'td', i: '⭐', n: 'Star Collector', d: 'Earn 30 stars.', p: 25, t: function () { return sum(rd('td2_stars')) >= 30; } },
    { id: 'tdstar2', g: 'td', i: '🌟', n: 'Perfect Defense', d: 'Earn 90 stars.', p: 100, t: function () { return sum(rd('td2_stars')) >= 90; } },
    { id: 'tdend', g: 'td', i: '♾️', n: 'Endless Siege', d: 'Survive 50 waves in Endless.', p: 50, t: function () { return num(TDR().bestEndless) >= 50; } },
    { id: 'tdach', g: 'td', i: '🏅', n: 'Decorated Defender', d: 'Earn 15 of Tower Defense\'s own achievements.', p: 50, t: function () { return cnt(rd('td2_ach')) >= 15; } },
    // Frontline
    { id: 'fl1', g: 'frontline', i: '🎯', n: 'First Victory', d: 'Win a battle.', p: 10, t: function () { return num(FL().wins) >= 1; } },
    { id: 'fl10', g: 'frontline', i: '🎖️', n: 'Field Commander', d: 'Win 10 battles.', p: 25, t: function () { return num(FL().wins) >= 10; } },
    { id: 'fl50', g: 'frontline', i: '⭐', n: 'Five-Star General', d: 'Win 50 battles.', p: 100, t: function () { return num(FL().wins) >= 50; } },
    { id: 'flkill', g: 'frontline', i: '💥', n: 'War Machine', d: 'Destroy 2,000 enemy units in total.', p: 25, t: function () { return num(FL().kills) >= 2000; } },
    { id: 'flmp', g: 'frontline', i: '🌐', n: 'Online Victor', d: 'Win an online battle against a friend.', p: 50, t: function () { return num(FL().mpWins) >= 1; } },
    { id: 'flcamp', g: 'frontline', i: '📜', n: 'Operation Complete', d: 'Win a Campaign operation.', p: 50, t: function () { return num(FL().cWins) >= 1; } },
    { id: 'flach', g: 'frontline', i: '🏅', n: 'Medal Rack', d: 'Earn 15 of Frontline\'s own medals.', p: 50, t: function () { return cnt(FL().ach) >= 15; } },
    // Blocky Shooter
    { id: 'bl1', g: 'blocky', i: '🔫', n: 'Lock and Load', d: 'Play a run of Blocky Shooter.', p: 10, t: function () { return num(BL().runs) >= 1; } },
    { id: 'blkill', g: 'blocky', i: '🧟', n: 'Zombie Slayer', d: 'Defeat 1,000 zombies.', p: 25, t: function () { return num(BL().kills) >= 1000; } },
    { id: 'blkill2', g: 'blocky', i: '☠️', n: 'Horde Breaker', d: 'Defeat 10,000 zombies.', p: 50, t: function () { return num(BL().kills) >= 1e4; } },
    { id: 'blhead', g: 'blocky', i: '🎯', n: 'Sharpshooter', d: 'Land 500 headshots.', p: 25, t: function () { return num(BL().headshots) >= 500; } },
    { id: 'blboss', g: 'blocky', i: '👹', n: 'Boss Hunter', d: 'Defeat 10 bosses.', p: 50, t: function () { return num(BL().bosses) >= 10; } },
    { id: 'blcamp', g: 'blocky', i: '📕', n: 'Survivor\'s Story', d: 'Finish 5 Campaign missions.', p: 25, t: function () { return cnt((rd('blocky50_campaign') || {}).done) >= 5; } },
    // Neon Dash family
    { id: 'nd1', g: 'neon', i: '⚡', n: 'Neon Runner', d: 'Score 1,000 in Neon Dash.', p: 10, t: function () { return (rd('neonScores') || []).some(function (s) { return num(s && s.val) >= 1000; }); } },
    { id: 'nd2', g: 'neon', i: '🌈', n: 'Neon Legend', d: 'Score 10,000 in Neon Dash.', p: 50, t: function () { return (rd('neonScores') || []).some(function (s) { return num(s && s.val) >= 10000; }); } },
    { id: 'ndfork', g: 'neon', i: '🍴', n: 'Fork in the Road', d: 'Reach level 10 in Hunter\'s Fork.', p: 25, t: function () { return num(rd('neonMaxLevel')) >= 10; } },
    // Sovereign (Sovereign writes 'sov.hgach' as you play; its own achievements are in 'sov.ach')
    { id: 'sovwar', g: 'sov', i: '⚔️', n: 'Victory', d: 'Win a war in Sovereign.', p: 25, t: function () { return num(SV().warsWon) >= 1; } },
    { id: 'sovconq', g: 'sov', i: '🏴', n: 'Conqueror', d: 'Take full control of another country.', p: 25, t: function () { return num(SV().conquered) >= 1; } },
    { id: 'sovconq10', g: 'sov', i: '🗺️', n: 'Empire Builder', d: 'Control 10 countries besides your own.', p: 50, t: function () { return num(SV().conquered) >= 10; } },
    { id: 'sovyears', g: 'sov', i: '📅', n: 'Long Reign', d: 'Rule for 20 years in one game.', p: 25, t: function () { return num(SV().years) >= 20; } },
    { id: 'sovach', g: 'sov', i: '🏅', n: 'Statesman', d: 'Earn 15 of Sovereign\'s own achievements.', p: 50, t: function () { return cnt(rd('sov.ach')) >= 15; } },
    { id: 'sovworld', g: 'sov', i: '🌍', n: 'World Domination', d: 'Control every country on Earth.', p: 100, t: function () { return !!SV().domination; } },
    // the launcher itself
    // Last Light
    { id: 'lu11', g: 'lumi', i: '🏮', n: 'First Light', d: "Finish the first level of Last Light.", p: 10, t: function () { return luDone('1-1'); } },
    { id: 'luw1', g: 'lumi', i: '🌲', n: 'Glowwood Glowing', d: 'Finish Glowwood (and learn the double jump).', p: 25, t: function () { return luDone('1-4'); } },
    { id: 'luw2', g: 'lumi', i: '💎', n: 'Crystal Clear', d: 'Finish the Hollow Caves.', p: 25, t: function () { return luDone('2-4'); } },
    { id: 'luw3', g: 'lumi', i: '☁️', n: 'Head in the Clouds', d: 'Finish the Sky Ruins.', p: 25, t: function () { return luDone('3-4'); } },
    { id: 'luw4', g: 'lumi', i: '🔥', n: 'Forged in Fire', d: 'Finish the Ember Forge.', p: 50, t: function () { return luDone('4-4'); } },
    { id: 'luboss', g: 'lumi', i: '🌟', n: 'Lightbringer', d: 'Defeat The Gloom.', p: 100, t: function () { return luDone('5-1'); } },
    { id: 'lumoth24', g: 'lumi', i: '⭐', n: 'Star Catcher', d: 'Find 24 stars.', p: 25, t: function () { return luMoths() >= 24; } },
    { id: 'lumoth48', g: 'lumi', i: '✨', n: 'Every Last Star', d: 'Find all 48 stars.', p: 100, t: function () { return luMoths() >= 48; } },
    { id: 'luguard', g: 'lumi', i: '🛡️', n: 'Guardian Breaker', d: 'Free all four world guardians.', p: 50, t: function () { return Object.keys(LU().guards || {}).length >= 4; } },
    { id: 'lulore8', g: 'lumi', i: '📜', n: 'Piecing It Together', d: 'Find 8 memories.', p: 25, t: function () { return Object.keys(LU().lore || {}).length >= 8; } },
    { id: 'lulore', g: 'lumi', i: '🕯️', n: 'The Whole Truth', d: 'Find all 17 memories.', p: 100, t: function () { return Object.keys(LU().lore || {}).length >= 17; } },
    { id: 'luspark', g: 'lumi', i: '💛', n: 'Spark Hoarder', d: 'Collect 500 sparks.', p: 25, t: function () { return num(LU().sparks) >= 500; } },
    { id: 'hubgames', g: 'hub', i: '🎮', n: 'Game Hopper', d: 'Play 5 different games.', p: 10, t: function () { return cnt(PL()) >= 5; } },
    { id: 'huball', g: 'hub', i: '🕹️', n: 'Completionist', d: 'Play 10 different games.', p: 25, t: function () { return cnt(PL()) >= 10; } },
    { id: 'hubfriend', g: 'hub', i: '🤝', n: 'Making Friends', d: 'Have a friend on Grapevine.', p: 10, t: function () { var L = window.HGGrapevine; return !!(L && L.friends().friends.length >= 1); } },
    { id: 'hubfriend5', g: 'hub', i: '🎉', n: 'Popular', d: 'Have 5 friends on Grapevine.', p: 25, t: function () { var L = window.HGGrapevine; return !!(L && L.friends().friends.length >= 5); } }
  ];
  var ACHBY = {}; ACH.forEach(function (a) { ACHBY[a.id] = a; });
  var achH = {};
  function achOn(ev, fn) { (achH[ev] = achH[ev] || []).push(fn); }
  function achEmit(ev, x) { (achH[ev] || []).forEach(function (f) { try { f(x); } catch (e) {} }); }
  function achGot() { var o = rd('hgach:v1'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  function achSummary(got) {
    got = got || achGot(); var ids = Object.keys(got).filter(function (k) { return ACHBY[k]; }), pts = 0;
    ids.forEach(function (k) { pts += ACHBY[k].p; });
    var show = ids.sort(function (a, b) { return (ACHBY[b].p - ACHBY[a].p) || (got[b] - got[a]); }).slice(0, 6).map(function (k) { var a = ACHBY[k]; return { g: AG[a.g], n: a.n, i: a.i }; });
    return { n: ids.length, of: ACH.length, pts: pts, show: show };
  }
  var achFirst = true;
  // Look again. New ones are announced (except on the very first look on a device, which only catches up quietly).
  function achCheck() {
    var got = achGot(), fresh = [];
    ACH.forEach(function (a) { if (got[a.id]) return; var ok = false; try { ok = !!a.t(); } catch (e) {} if (ok) { got[a.id] = Date.now(); fresh.push(a); } });
    if (fresh.length) { try { localStorage.setItem('hgach:v1', JSON.stringify(got)); } catch (e) {} }
    var quiet = achFirst && !rd('hgach:seen'); achFirst = false;
    if (quiet) { try { localStorage.setItem('hgach:seen', '1'); } catch (e) {} }
    else fresh.forEach(function (a) { achEmit('unlock', a); });
    var L = window.HGGrapevine; if (L && L.me() && L.setAchievements) L.setAchievements(achSummary(got));
    if (fresh.length) achEmit('change');
    return fresh;
  }
  function achPlayed(dir) { var o = PL(); if (o[dir]) return; o[dir] = Date.now(); try { localStorage.setItem('hgach:plays', JSON.stringify(o)); } catch (e) {} }
  window.HGAch = { list: ACH, games: AG, got: achGot, summary: achSummary, check: achCheck, played: achPlayed, on: achOn, byId: function (id) { return ACHBY[id]; } };
  setInterval(function () { try { achCheck(); } catch (e) {} }, 20000);
  setTimeout(function () { try { achCheck(); } catch (e) {} }, 4000);
